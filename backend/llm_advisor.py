"""
AeroRoute — LLM Pre-Flight Safety Advisor
=========================================
Uses Groq Cloud (Llama 3.3 70B / Llama 3.1 8B) for real-time aerospace
dispatch validation, risk quantification, and flight safety analysis.
Includes graceful fallback if no API key is provided or offline.
"""

import json
import os
import re
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()


def _get_fallback_verdict(data: dict, note: str = "") -> dict:
    """Generate high-precision aerospace safety analysis without external API."""
    payload = float(data.get("payload_weight_kg", 2.0))
    max_payload = float(data.get("max_payload_kg", 3.5))
    current_battery = float(data.get("current_battery_pct", 100.0))
    predicted_drain = float(data.get("predicted_drain_pct", 25.0))
    remaining_battery = max(0.0, current_battery - predicted_drain)
    distance_km = float(data.get("flight_distance_km", 10.0))
    wind_gust = float(data.get("wind_gust_ms", 5.0))
    drone_id = data.get("drone_id", "DRONE")
    dest_name = data.get("destination_name", "Mumbai Destination")

    is_overweight = payload > max_payload
    is_battery_critical = remaining_battery < 20.0 or current_battery < (predicted_drain + 10.0)
    is_battery_tight = not is_battery_critical and remaining_battery < 35.0
    is_high_wind = wind_gust > 15.0

    if is_overweight:
        verdict = "BLOCKED"
        status_label = "⛔ BLOCKED: CARGO OVERWEIGHT"
        risk_score = 95
        key_risks = [
            f"Cargo mass ({payload:.1f} kg) exceeds {drone_id} rated limit ({max_payload:.1f} kg)",
            "Propulsion strain will induce motor overheating and severe altitude instability",
        ]
        analysis = (
            f"Dispatch blocked by safety interlock: {payload:.1f} kg payload exceeds {drone_id} structural "
            f"rating of {max_payload:.1f} kg. Select a heavy-lift drone or split cargo."
        )
        recommendation = "Reassign to heavy-lift airframe (e.g., Aero-X Heavy) or reduce package weight."

    elif is_battery_critical:
        verdict = "BLOCKED"
        status_label = "⚠️ UNSAFE: INSUFFICIENT CHARGE"
        risk_score = 90
        key_risks = [
            f"Depletion risk: Predicted drain {predicted_drain:.0f}% leaves only {remaining_battery:.0f}% reserve",
            "Emergency landing or forced RTB inevitable before reaching delivery drop zone",
        ]
        analysis = (
            f"Mission rejected: Drone battery ({current_battery:.0f}%) insufficient for {distance_km:.1f} km transit to {dest_name}. "
            f"Minimum {predicted_drain + 25:.0f}% charge required to ensure emergency safety margins."
        )
        recommendation = "Charge drone to at least 85% or assign an alternate fleet unit on hot standby."

    elif is_battery_tight or is_high_wind:
        verdict = "CAUTION"
        status_label = "⚡ CAUTION: TIGHT RESERVE MARGIN"
        risk_score = 55
        key_risks = [
            f"Tight battery reserve of {remaining_battery:.0f}% upon arrival",
            f"Mumbai coastal wind vectors ({wind_gust:.1f} m/s) will increase drag resistance",
        ]
        analysis = (
            f"Mission approved with operational constraints: Flight to {dest_name} ({distance_km:.1f} km) feasible, "
            f"but leaves narrow {remaining_battery:.0f}% battery cushion upon drop-off."
        )
        recommendation = "Maintain altitude between 100m–120m to minimize ground turbulence. Execute immediate RTB protocol."

    else:
        verdict = "SAFE"
        status_label = "✅ DISPATCH APPROVED — SAFE FLIGHT"
        risk_score = 12
        payload_ratio = int((payload / max(max_payload, 0.1)) * 100)
        key_risks = [
            f"Healthy {payload_ratio}% payload capacity utilization",
            f"Safe {remaining_battery:.0f}% battery reserve maintained upon target arrival",
        ]
        analysis = (
            f"AI Pre-Flight Confirmed: Nominal aerodynamics for {distance_km:.1f} km route to {dest_name}. "
            f"Safe payload ratio ({payload_ratio}%) and robust {remaining_battery:.0f}% arrival battery."
        )
        recommendation = "Proceed with automated dispatch. Clear for immediate vertiport launch."

    return {
        "verdict": verdict,
        "status_label": status_label,
        "analysis": analysis,
        "risk_score": risk_score,
        "key_risks": key_risks,
        "recommendation": recommendation,
        "model_used": "AeroRoute Aerospace Safety Engine",
        "source": "aeroroute-engine",
        "note": note or ("Add GROQ_API_KEY in backend/.env for live Llama-3.3 inference" if not GROQ_API_KEY else ""),
    }


async def evaluate_pre_flight_with_llm(data: dict) -> dict:
    """
    Evaluate pre-flight parameters using Groq Cloud LLM (Llama 3.3).
    Falls back gracefully if Groq is unavailable or key is unset.
    """
    api_key = os.getenv("GROQ_API_KEY", "").strip() or GROQ_API_KEY
    if not api_key:
        return _get_fallback_verdict(data, note="Add GROQ_API_KEY in backend/.env for live Groq Llama-3.3")

    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=api_key, timeout=4.0)

        payload = float(data.get("payload_weight_kg", 2.0))
        max_payload = float(data.get("max_payload_kg", 3.5))
        current_battery = float(data.get("current_battery_pct", 100.0))
        predicted_drain = float(data.get("predicted_drain_pct", 25.0))
        remaining_battery = max(0.0, current_battery - predicted_drain)
        distance_km = float(data.get("flight_distance_km", 10.0))
        wind_gust = float(data.get("wind_gust_ms", 5.0))
        drone_id = data.get("drone_id", "BOM-001")
        drone_model = data.get("drone_model", "Phantom-Mumbai X7")
        dest_name = data.get("destination_name", "Mumbai Destination")

        prompt = f"""
You are AeroRoute's Autonomous Flight Safety & Mission Dispatch AI Advisor for Mumbai Airspace.
Analyze the following drone flight parameters and provide a real-time safety evaluation.

FLIGHT TELEMETRY:
- Drone ID: {drone_id} ({drone_model})
- Battery Level: {current_battery:.1f}%
- Rated Max Payload: {max_payload:.1f} kg
- Assigned Cargo Mass: {payload:.1f} kg ({(payload/max_payload)*100:.0f}% of max capacity)
- Destination: {dest_name} ({distance_km:.1f} km from hub)
- Predicted Battery Drain: ~{predicted_drain:.0f}%
- Projected Reserve on Arrival: ~{remaining_battery:.0f}%
- Coastal Wind Gust: {wind_gust:.1f} m/s

RULES:
1. If cargo ({payload:.1f} kg) > max payload ({max_payload:.1f} kg) -> verdict MUST be "BLOCKED" (Overweight).
2. If remaining battery on arrival < 20% or current battery < predicted_drain + 10% -> verdict MUST be "BLOCKED" (Critical battery).
3. If remaining battery is 20-35% or wind > 14 m/s -> verdict MUST be "CAUTION".
4. Otherwise -> verdict is "SAFE".

Respond ONLY with a valid JSON object with EXACTLY this structure (no markdown fences, no extra text):
{{
  "verdict": "SAFE" | "CAUTION" | "BLOCKED",
  "status_label": "Short label with emoji, e.g. '✅ DISPATCH APPROVED — SAFE FLIGHT' or '⛔ BLOCKED: CARGO OVERWEIGHT'",
  "analysis": "1-2 concise, professional sentences analyzing why this flight is safe or hazardous",
  "risk_score": integer between 0 and 100,
  "key_risks": ["Risk point 1", "Risk point 2"],
  "recommendation": "1 sentence practical action for the delivery agent/dispatcher"
}}
"""

        response = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a professional aerospace safety AI engine. Respond ONLY in strict valid JSON format."},
                {"role": "user", "content": prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.2,
            max_tokens=350,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content.strip()
        parsed = json.loads(content)

        return {
            "verdict": parsed.get("verdict", "SAFE"),
            "status_label": parsed.get("status_label", "✅ DISPATCH APPROVED — SAFE FLIGHT"),
            "analysis": parsed.get("analysis", "AI validated nominal flight parameters."),
            "risk_score": int(parsed.get("risk_score", 15)),
            "key_risks": parsed.get("key_risks", []),
            "recommendation": parsed.get("recommendation", "Proceed with dispatch."),
            "model_used": f"Groq ({GROQ_MODEL})",
            "source": "groq-llm",
        }

    except Exception as e:
        print(f"[!] Groq LLM evaluation error: {e}. Falling back to internal engine.")
        return _get_fallback_verdict(data, note=f"Groq: {str(e)[:60]}")
