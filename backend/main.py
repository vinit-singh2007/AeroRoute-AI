"""
AeroRoute — FastAPI Backend Entry Point
=======================================
Endpoints:
  POST /api/optimize-route     → GA-based route optimisation
  POST /api/predict-battery    → ML battery drain prediction
  POST /api/fuzzy-safety       → Fuzzy FSI evaluation
  WS   /ws/telemetry           → Live drone telemetry stream (1 Hz)
"""

import asyncio
import math
import random
import time
from contextlib import asynccontextmanager
from typing import List, Optional

import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ml_models import predict_battery_drain, train_battery_model
from database import db_manager
from llm_advisor import evaluate_pre_flight_with_llm
from soft_computing import (
    GeneticRouteOptimizer,
    AStarRouteOptimizer,
    segment_intersects_nfz,
    FuzzyFlightSafety,
    NO_FLY_ZONES,
    haversine,
    get_fuzzy_engine,
)
from weather_service import weather_service


# ===========================================================================
# STARTUP / SHUTDOWN
# ===========================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Connect to MongoDB, pre-train ML model on startup, and start live telemetry broadcast."""
    print("[*] Connecting to MongoDB persistence layer...")
    await db_manager.connect()
    # Seed default fleet in DB if empty, or sync from DB
    await db_manager.seed_default_drones(_simulator.DEFAULT_FLEET)
    db_drones = await db_manager.get_all_drones()
    if db_drones:
        _simulator.sync_from_db(db_drones)

    print("[*] AeroRoute backend starting - training battery model...")
    train_battery_model()
    print("[+] Battery model ready.")
    telemetry_task = asyncio.create_task(telemetry_broadcast_loop())
    print("[+] Telemetry broadcast loop active.")
    yield
    telemetry_task.cancel()
    await db_manager.disconnect()
    print("[-] AeroRoute backend shutting down.")


# ===========================================================================
# APP INIT
# ===========================================================================

app = FastAPI(
    title="AeroRoute API",
    description="AI & Soft Computing powered Drone Route Optimisation Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===========================================================================
# REQUEST / RESPONSE MODELS
# ===========================================================================

class LatLon(BaseModel):
    lat: float
    lng: float


class OptimizeRouteRequest(BaseModel):
    origin:               LatLon
    destination:          LatLon
    payload_weight_kg:    float = Field(default=1.0, ge=0.1, le=10.0)
    wind_speed_ms:        float = Field(default=5.0,  ge=0.0, le=30.0)
    max_battery_drain_pct: float = Field(default=85.0, ge=10.0, le=100.0)
    intermediate_stops:   Optional[List[LatLon]] = []
    algorithm:            Optional[str] = "astar"  # "astar" | "ga"


class BatteryPredictRequest(BaseModel):
    payload_weight_kg:    float = Field(ge=0.1, le=10.0)
    elevation_change_m:   float = Field(default=50.0)
    distance_km:          float = Field(ge=0.1, le=100.0)
    wind_speed_ms:        float = Field(default=5.0, ge=0.0, le=30.0)


class FuzzySafetyRequest(BaseModel):
    wind_gust_ms:         float = Field(ge=0.0,  le=30.0)
    battery_level_pct:    float = Field(ge=0.0,  le=100.0)
    distance_to_hub_km:   float = Field(ge=0.0,  le=100.0)


class CreateDroneRequest(BaseModel):
    id: str
    model: str = "Aero-X Heavy"
    max_payload_kg: float = 3.5
    max_speed_kmh: float = 65.0
    battery_pct: float = 100.0
    secret_code: str = Field(default="AERO-ADMIN", min_length=3, description="Secret authorization code for decommissioning")
    lat: Optional[float] = None
    lng: Optional[float] = None


class DeleteDroneRequest(BaseModel):
    secret_code: str


class DispatchMissionRequest(BaseModel):
    drone_id: str
    destination: LatLon
    destination_name: Optional[str] = "Customer Drop Location"
    order_id: Optional[str] = "ORD-101"
    agent_name: Optional[str] = "Delivery Agent"
    payload_weight_kg: float = 2.0


class PreFlightCheckRequest(BaseModel):
    drone_id: str
    drone_model: Optional[str] = "Phantom-Mumbai X7"
    current_battery_pct: float = Field(ge=0.0, le=100.0)
    max_payload_kg: float = Field(ge=0.1, le=10.0)
    payload_weight_kg: float = Field(ge=0.1, le=10.0)
    flight_distance_km: float = Field(ge=0.1, le=100.0)
    predicted_drain_pct: float = Field(default=25.0, ge=0.0, le=100.0)
    remaining_battery_pct: float = Field(default=75.0, ge=0.0, le=100.0)
    destination_name: Optional[str] = "Mumbai Delivery Point"
    wind_gust_ms: Optional[float] = 5.0


# ===========================================================================
# REST ENDPOINTS
# ===========================================================================

@app.get("/", tags=["Health"])
async def root():
    return {"status": "online", "service": "AeroRoute API (Mumbai)", "version": "1.0.0"}


@app.get("/api/drones", tags=["Fleet Management"])
async def list_drones():
    """Return all currently active registered drones."""
    return {"drones": _simulator.get_drones_summary()}


@app.post("/api/drones", tags=["Fleet Management"])
async def add_drone(req: CreateDroneRequest):
    """Dynamically register and launch a new drone with secret code into the fleet and persist to MongoDB."""
    drone = _simulator.add_drone(req.model_dump())
    await db_manager.upsert_drone(drone)
    await manager.broadcast({
        "type": "telemetry",
        "drones": _simulator.tick(),
        "hub": {"lat": DroneSimulator.HUB_LAT, "lng": DroneSimulator.HUB_LON},
        "server_time": time.time(),
    })
    return {"status": "SUCCESS", "message": f"Drone {req.id} registered & saved to MongoDB", "drone": drone}


@app.delete("/api/drones/{drone_id}", tags=["Fleet Management"])
async def delete_drone(drone_id: str, secret_code: Optional[str] = Query(None), body: Optional[DeleteDroneRequest] = None):
    """Remove a single drone from active fleet and MongoDB with mandatory secret authorization code verification."""
    code = (secret_code or (body.secret_code if body else None) or "").strip()
    if not code:
        raise HTTPException(
            status_code=400,
            detail="Secret authorization code is required to decommission drone."
        )

    # 1. Check in active simulator drone
    active_drone = _simulator.get_drone(drone_id)
    stored_code = None
    if active_drone:
        stored_code = active_drone.get("secret_code")

    # 2. Check in MongoDB if missing or not in simulator
    if not stored_code and db_manager.connected:
        db_drone = await db_manager.get_drone(drone_id)
        if db_drone:
            stored_code = db_drone.get("secret_code")

    ADMIN_MASTER_PASSWORD = "12345"
    expected_code = (stored_code or "AERO-ADMIN").strip()
    # Global admin override — master password bypasses per-drone secret code
    if code != ADMIN_MASTER_PASSWORD and code != expected_code:
        raise HTTPException(
            status_code=403,
            detail=f"Authorization Failed: Invalid Secret Code for drone {drone_id}."
        )

    _simulator.remove_drone(drone_id)
    await db_manager.remove_drone(drone_id)
    await manager.broadcast({
        "type": "telemetry",
        "drones": _simulator.tick(),
        "hub": {"lat": DroneSimulator.HUB_LAT, "lng": DroneSimulator.HUB_LON},
        "server_time": time.time(),
    })
    return {"status": "SUCCESS", "message": f"Drone {drone_id} authorized & successfully decommissioned"}


@app.delete("/api/drones", tags=["Fleet Management"])
async def delete_all_drones():
    """Bulk deletion is disabled per user security policy."""
    raise HTTPException(
        status_code=405,
        detail="Bulk deletion is disabled. Drones must be decommissioned individually using their secret code."
    )


@app.post("/api/drones/reset", tags=["Fleet Management"])
async def reset_fleet_endpoint():
    """Reset fleet to default configuration and sync to MongoDB."""
    _simulator._init_fleet()
    await db_manager.clear_fleet()
    await db_manager.seed_default_drones(_simulator.DEFAULT_FLEET)
    await manager.broadcast({
        "type": "telemetry",
        "drones": _simulator.tick(),
        "hub": {"lat": DroneSimulator.HUB_LAT, "lng": DroneSimulator.HUB_LON},
        "server_time": time.time(),
    })
    return {"status": "SUCCESS", "message": "Fleet reset to default configuration & re-seeded in MongoDB"}


@app.post("/api/dispatch-mission", tags=["Fleet Management"])
async def dispatch_mission(req: DispatchMissionRequest):
    """Assign an order destination and delivery agent to an active drone, computing optimal A* path and saving to MongoDB."""
    mission_info = {
        "destination": {"lat": req.destination.lat, "lng": req.destination.lng, "name": req.destination_name},
        "order_id": req.order_id,
        "agent_name": req.agent_name,
        "payload_kg": req.payload_weight_kg
    }
    result = _simulator.assign_mission(req.drone_id, mission_info)
    if not result:
        raise HTTPException(status_code=404, detail=f"Drone {req.drone_id} not found in fleet")

    drone, astar_route = result

    # Persist mission into MongoDB
    await db_manager.save_mission({
        "order_id": req.order_id,
        "drone_id": req.drone_id,
        "drone_model": drone.get("model", "Drone"),
        "agent_name": req.agent_name,
        "destination_name": req.destination_name,
        "dest_lat": req.destination.lat,
        "dest_lng": req.destination.lng,
        "payload_kg": req.payload_weight_kg,
        "status": "EN_ROUTE",
        "algorithm": "A* (A-Star Shortest Path)",
        "total_distance_km": astar_route.get("total_distance_km"),
        "redzones_avoided": astar_route.get("redzones_avoided", []),
        "dispatched_at": drone.get("mission_start_time", time.strftime("%H:%M:%S")),
        "start_battery_pct": round(drone.get("battery", 100.0), 1),
    })

    # Broadcast updated telemetry immediately to all connected clients
    await manager.broadcast({
        "type": "telemetry",
        "drones": _simulator.get_drones_summary(),
        "hub": {"lat": DroneSimulator.HUB_LAT, "lng": DroneSimulator.HUB_LON},
        "server_time": time.time(),
    })

    return {
        "status": "SUCCESS",
        "message": f"Order {req.order_id} assigned to {req.drone_id} via A* Shortest Route ({astar_route.get('total_distance_km')} km)",
        "drone": drone,
        "route": astar_route,
    }


@app.get("/api/missions", tags=["Fleet Management"])
async def get_missions():
    """Return all active en-route missions and delivered order history merged with MongoDB persistence."""
    summary = _simulator.get_missions_summary()
    db_missions = await db_manager.get_missions(limit=50)
    if db_missions:
        delivered_ids = {m["order_id"] for m in summary.get("delivered_missions", [])}
        for dbm in db_missions:
            if dbm.get("status") == "DELIVERED" and dbm.get("order_id") not in delivered_ids:
                summary["delivered_missions"].append(dbm)
                delivered_ids.add(dbm.get("order_id"))
        summary["stats"]["delivered_count"] = len(summary["delivered_missions"])
        summary["stats"]["total_dispatched"] = summary["stats"]["currently_active"] + summary["stats"]["delivered_count"]
    return summary


@app.get("/api/no-fly-zones", tags=["Map Data"])
async def get_no_fly_zones():
    """Return all registered no-fly zones for map rendering."""
    return {"no_fly_zones": NO_FLY_ZONES}


@app.post("/api/astar-route", tags=["Route Optimisation"])
async def astar_route_endpoint(req: OptimizeRouteRequest):
    """
    Execute A* (A-Star) Pathfinding Algorithm to find the exact shortest,
    collision-free route around Mumbai Red Zones and weather obstacles.
    """
    origin = (req.origin.lat, req.origin.lng)
    destination = (req.destination.lat, req.destination.lng)

    optimizer = AStarRouteOptimizer(
        origin=origin,
        destination=destination,
        wind_speed=req.wind_speed_ms,
        payload_weight=req.payload_weight_kg,
        safety_margin_km=0.4,
    )
    result = optimizer.optimize()

    # Persist route to MongoDB
    try:
        await db_manager.save_route({
            "algorithm": "A*",
            "origin": {"lat": req.origin.lat, "lng": req.origin.lng},
            "destination": {"lat": req.destination.lat, "lng": req.destination.lng},
            "payload_weight_kg": req.payload_weight_kg,
            "wind_speed_ms": req.wind_speed_ms,
            "total_distance_km": result.get("total_distance_km"),
            "estimated_battery_drain_pct": result.get("estimated_battery_drain"),
            "eta_minutes": result.get("estimated_eta_minutes"),
            "waypoints_count": len(result.get("waypoints", [])),
            "redzones_avoided": result.get("redzones_avoided", []),
        })
    except Exception as e:
        print(f"[!] DB route logging error: {e}")

    return result


@app.post("/api/optimize-route", tags=["Route Optimisation"])
async def optimize_route(req: OptimizeRouteRequest):
    """
    Find optimal drone route. Defaults to A* Shortest Path with Red Zone avoidance.
    If intermediate stops are specified or algorithm='ga', executes Genetic Algorithm.
    """
    origin      = (req.origin.lat,      req.origin.lng)
    destination = (req.destination.lat, req.destination.lng)
    stops       = [(s.lat, s.lng) for s in (req.intermediate_stops or [])]
    algo        = (req.algorithm or "astar").lower()

    if algo == "astar" or not stops:
        optimizer = AStarRouteOptimizer(
            origin=origin,
            destination=destination,
            wind_speed=req.wind_speed_ms,
            payload_weight=req.payload_weight_kg,
            safety_margin_km=0.4,
        )
        result = optimizer.optimize()
    else:
        optimizer = GeneticRouteOptimizer(
            origin=origin,
            destination=destination,
            intermediate_points=stops,
            payload_weight=req.payload_weight_kg,
            max_battery_drain=req.max_battery_drain_pct,
            wind_speed=req.wind_speed_ms,
        )
        loop   = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, optimizer.optimize)

    # Persist optimized route to MongoDB
    try:
        await db_manager.save_route({
            "algorithm": result.get("algorithm", "A*"),
            "origin": {"lat": req.origin.lat, "lng": req.origin.lng},
            "destination": {"lat": req.destination.lat, "lng": req.destination.lng},
            "intermediate_stops": [{"lat": s.lat, "lng": s.lng} for s in (req.intermediate_stops or [])],
            "payload_weight_kg": req.payload_weight_kg,
            "wind_speed_ms": req.wind_speed_ms,
            "total_distance_km": result.get("total_distance_km"),
            "estimated_battery_drain_pct": result.get("estimated_battery_drain") or result.get("battery_drain_estimate_pct"),
            "eta_minutes": result.get("estimated_eta_minutes") or result.get("eta_minutes"),
            "waypoints_count": len(result.get("waypoints", [])),
            "redzones_avoided": result.get("redzones_avoided", []),
        })
    except Exception as e:
        print(f"[!] DB route logging error: {e}")

    return result


@app.get("/api/database/status", tags=["Database"])
async def get_database_status():
    """Check MongoDB health, connection state, and collections document counts."""
    return await db_manager.get_db_status()


@app.get("/api/database/missions", tags=["Database"])
async def get_database_missions(limit: int = 50):
    """Retrieve persisted mission logs from MongoDB."""
    missions = await db_manager.get_missions(limit=limit)
    return {"missions": missions, "count": len(missions)}


@app.get("/api/database/routes", tags=["Database"])
async def get_database_routes(limit: int = 20):
    """Retrieve persisted genetic algorithm routes from MongoDB."""
    routes = await db_manager.get_recent_routes(limit=limit)
    return {"routes": routes, "count": len(routes)}


@app.post("/api/predict-battery", tags=["ML Prediction"])
async def predict_battery(req: BatteryPredictRequest):
    """Predict battery drain % using the trained ML regression model."""
    return predict_battery_drain(
        payload_weight   = req.payload_weight_kg,
        elevation_change = req.elevation_change_m,
        distance         = req.distance_km,
        wind_speed       = req.wind_speed_ms,
    )


@app.post("/api/fuzzy-safety", tags=["Soft Computing"])
async def fuzzy_safety(req: FuzzySafetyRequest):
    """Evaluate real-time Flight Safety Index (FSI) using Fuzzy Logic."""
    engine = get_fuzzy_engine()
    return engine.evaluate(
        wind_gust       = req.wind_gust_ms,
        battery_level   = req.battery_level_pct,
        distance_to_hub = req.distance_to_hub_km,
    )


@app.post("/api/ai/preflight-safety-check", tags=["AI Pre-Flight"])
async def preflight_safety_check(req: PreFlightCheckRequest):
    """
    LLM-powered aerospace safety check for drone dispatch.
    Evaluates cargo limits, battery depletion, wind vectors, and delivers an AI verdict.
    """
    return await evaluate_pre_flight_with_llm(req.model_dump())


@app.get("/api/weather/current", tags=["Weather"])
async def get_current_weather(
    lat: float = Query(default=19.1940, ge=-90.0, le=90.0),
    lon: float = Query(default=72.8550, ge=-180.0, le=180.0),
):
    """
    Fetch real-time atmospheric weather (wind speed, wind gusts, temperature,
    humidity, and condition) directly from Open-Meteo API for Mumbai airspace.
    """
    return weather_service.fetch_live_weather(lat=lat, lon=lon)


# ===========================================================================
# DRONE SIMULATOR — STATE
# ===========================================================================

class DroneSimulator:
    """Simulates a drone flying between two points with live telemetry (Mumbai)."""

    DEFAULT_FLEET = [
        {"id": "BOM-001", "model": "Phantom-Mumbai X7",   "max_payload_kg": 3.5, "secret_code": "AERO-001"},
        {"id": "BOM-002", "model": "Falcon-Marine Lite",   "max_payload_kg": 2.5, "secret_code": "AERO-002"},
        {"id": "BOM-003", "model": "Eagle-Harbor Pro",     "max_payload_kg": 5.0, "secret_code": "AERO-003"},
        {"id": "BOM-004", "model": "SkyRaider Cargo",      "max_payload_kg": 4.5, "secret_code": "AERO-004"},
        {"id": "BOM-005", "model": "AeroTitan Heavy",      "max_payload_kg": 6.0, "secret_code": "AERO-005"},
    ]

    # Midway MMR Central Logistics Hub (Centered between Churchgate ~18.93 and Virar ~19.45)
    HUB_LAT, HUB_LON = 19.1940, 72.8550

    @staticmethod
    def make_safe_coordinates(lat: float, lon: float, safety_margin_km: float = 0.5) -> Tuple[float, float]:
        """Guarantee coordinates are strictly outside all Mumbai No-Fly Zones (red zones)."""
        for zone in NO_FLY_ZONES:
            clat, clon = zone["center"]
            dist_km = haversine(lat, lon, clat, clon)
            required_r = zone["radius_km"] + safety_margin_km
            if dist_km < required_r:
                dlat = lat - clat
                dlon = lon - clon
                mag = math.hypot(dlat, dlon)
                if mag < 1e-6:
                    dlat, dlon, mag = -0.02, 0.0, 0.02
                deg_push = ((required_r - dist_km) / 111.0) + 0.005
                lat += (dlat / mag) * deg_push
                lon += (dlon / mag) * deg_push
        return lat, lon

    def __init__(self):
        self.drones: List[dict] = []
        self.active_missions: dict = {}
        self.delivered_missions: list = [
            {
                "order_id": "ORD-MUM-8104",
                "drone_id": "BOM-002",
                "drone_model": "Falcon-Marine Lite",
                "agent_name": "Agent Vikram Malhotra",
                "destination_name": "Andheri East Commercial Drop",
                "payload_kg": 2.2,
                "status": "DELIVERED",
                "dispatched_at": "23:15:00",
                "delivered_at": "23:42:18",
                "final_battery_pct": 68.4,
                "distance_km": 11.4,
            },
            {
                "order_id": "ORD-MUM-7651",
                "drone_id": "BOM-003",
                "drone_model": "Eagle-Harbor Pro",
                "agent_name": "Agent Priya Sharma",
                "destination_name": "Powai Hiranandani Tech Hub",
                "payload_kg": 1.5,
                "status": "DELIVERED",
                "dispatched_at": "22:40:10",
                "delivered_at": "23:08:45",
                "final_battery_pct": 74.0,
                "distance_km": 9.2,
            },
            {
                "order_id": "ORD-MUM-7219",
                "drone_id": "BOM-001",
                "drone_model": "Phantom-Mumbai X7",
                "agent_name": "Agent Rohit Verma",
                "destination_name": "Dadar Central Depot",
                "payload_kg": 3.0,
                "status": "DELIVERED",
                "dispatched_at": "22:05:20",
                "delivered_at": "22:28:10",
                "final_battery_pct": 52.5,
                "distance_km": 7.6,
            }
        ]
        self._init_fleet()

    def _init_fleet(self):
        self.drones = []
        self.active_missions = {}
        for d in self.DEFAULT_FLEET:
            lat = self.HUB_LAT + random.uniform(-0.005, 0.005)
            lon = self.HUB_LON + random.uniform(-0.005, 0.005)
            lat, lon = self.make_safe_coordinates(lat, lon, 0.5)
            self.drones.append({
                **d,
                "secret_code":   d.get("secret_code", "AERO-ADMIN"),
                "lat":           lat,
                "lon":           lon,
                "altitude":      0.0,
                "battery":       random.uniform(94, 100),
                "speed":         0.0,
                "status":        "STANDBY",
                "heading":       0.0,
                "dest_lat":      self.HUB_LAT,
                "dest_lon":      self.HUB_LON,
                "wind_gust":     round(weather_service.get_live_wind() + random.uniform(-0.3, 0.3), 1),
                "fsi":           98.0,
                "action_status": "SAFE",
                "order_id":      "STANDBY",
                "destination_name": "MMR Central Hub (Standby)",
                "agent_name":    "Logistics Officer",
                "payload_kg":    0.0,
            })

    def sync_from_db(self, db_drones: List[dict]):
        """Populate or update simulator active fleet from MongoDB documents and ensure default fleet."""
        new_drones = []
        existing_ids = set()
        if db_drones:
            for doc in db_drones:
                lat = doc.get("lat") or self.HUB_LAT
                lon = doc.get("lng") or self.HUB_LON
                lat, lon = self.make_safe_coordinates(float(lat), float(lon), 0.5)
                new_drones.append({
                    "id": doc["id"],
                    "model": doc.get("model", "Aero-X Standard"),
                    "max_payload_kg": float(doc.get("max_payload_kg", 3.0)),
                    "max_speed_kmh": float(doc.get("max_speed_kmh", 65.0)),
                    "secret_code": doc.get("secret_code", "AERO-ADMIN"),
                    "lat": float(lat),
                    "lon": float(lon),
                    "altitude": float(doc.get("altitude", 0.0)),
                    "battery": float(doc.get("battery_pct", 100.0)),
                    "speed": float(doc.get("speed", 0.0)),
                    "status": doc.get("status", "STANDBY"),
                    "heading": float(doc.get("heading", 0.0)),
                    "dest_lat": float(doc.get("dest_lat", self.HUB_LAT)),
                    "dest_lon": float(doc.get("dest_lon", self.HUB_LON)),
                    "wind_gust": round(weather_service.get_live_wind() + random.uniform(-0.3, 0.3), 1),
                    "fsi": float(doc.get("fsi", 95.0)),
                    "action_status": "SAFE",
                    "order_id": doc.get("order_id", "STANDBY"),
                    "destination_name": doc.get("destination_name", "MMR Central Hub (Standby)"),
                    "agent_name": doc.get("agent_name", "Logistics Officer"),
                    "payload_kg": float(doc.get("payload_kg", 0.0)),
                })
                existing_ids.add(doc["id"])

        # Also add any missing default fleet units
        for d in self.DEFAULT_FLEET:
            if d["id"] not in existing_ids:
                lat = self.HUB_LAT + random.uniform(-0.005, 0.005)
                lon = self.HUB_LON + random.uniform(-0.005, 0.005)
                lat, lon = self.make_safe_coordinates(lat, lon, 0.5)
                new_drones.append({
                    **d,
                    "secret_code":   d.get("secret_code", "AERO-ADMIN"),
                    "lat":           lat,
                    "lon":           lon,
                    "altitude":      random.uniform(90, 140),
                    "battery":       100.0,
                    "speed":         random.uniform(45, 60),
                    "status":        "STANDBY",
                    "heading":       random.uniform(0, 360),
                    "dest_lat":      self.HUB_LAT,
                    "dest_lon":      self.HUB_LON,
                    "wind_gust":     round(weather_service.get_live_wind() + random.uniform(-0.3, 0.3), 1),
                    "fsi":           90.0,
                    "action_status": "SAFE",
                    "order_id":      "STANDBY",
                    "destination_name": "MMR Central Hub (Standby)",
                    "agent_name":    "Logistics Officer",
                    "payload_kg":    0.0,
                })
        self.drones = new_drones

    def add_drone(self, drone_data: dict) -> dict:
        """Register a user-defined drone with custom specs stationed at MMR Central Hub launchpad."""
        lat = drone_data.get("lat") or (self.HUB_LAT + random.uniform(-0.003, 0.003))
        lon = drone_data.get("lng") or (self.HUB_LON + random.uniform(-0.003, 0.003))
        lat, lon = self.make_safe_coordinates(float(lat), float(lon), 0.5)
        new_drone = {
            "id":             drone_data["id"],
            "model":          drone_data.get("model", "Aero-X Standard"),
            "max_payload_kg": float(drone_data.get("max_payload_kg", 3.0)),
            "max_speed_kmh":  float(drone_data.get("max_speed_kmh", 65.0)),
            "secret_code":    str(drone_data.get("secret_code") or "AERO-ADMIN"),
            "lat":            float(lat),
            "lon":            float(lon),
            "altitude":       0.0,
            "battery":        float(drone_data.get("battery_pct", 100.0)),
            "speed":          0.0,
            "status":         "STANDBY",
            "heading":        0.0,
            "dest_lat":       self.HUB_LAT,
            "dest_lon":       self.HUB_LON,
            "wind_gust":      round(weather_service.get_live_wind() + random.uniform(-0.3, 0.3), 1),
            "fsi":            98.0,
            "action_status":  "SAFE",
            "order_id":       "STANDBY",
            "destination_name": "MMR Central Hub (Launchpad Standby)",
            "agent_name":     "Ground Operations",
            "payload_kg":     0.0,
        }
        # Replace if exists, or append
        self.drones = [d for d in self.drones if d["id"] != new_drone["id"]]
        self.drones.append(new_drone)
        return new_drone

    def get_drone(self, drone_id: str) -> Optional[dict]:
        """Fetch an active drone by ID from simulator."""
        for d in self.drones:
            if d["id"] == drone_id:
                return d
        return None

    def remove_drone(self, drone_id: str):
        """Remove a drone from the simulation."""
        self.drones = [d for d in self.drones if d["id"] != drone_id]
        self.active_missions = {
            oid: m for oid, m in self.active_missions.items()
            if m.get("drone_id") != drone_id
        }

    def clear_fleet(self):
        """Remove all drones from the simulation."""
        self.drones = []
        self.active_missions = {}

    def get_drones_summary(self) -> List[dict]:
        return [
            {
                "id":               d["id"],
                "model":            d.get("model", "Aero-X Standard"),
                "max_payload_kg":   d.get("max_payload_kg", 3.0),
                "max_speed_kmh":    d.get("max_speed_kmh", 65.0),
                "battery_pct":      round(d.get("battery", 100.0), 1),
                "status":           d.get("status", "IDLE"),
                "lat":              round(d.get("lat", self.HUB_LAT), 6),
                "lng":              round(d.get("lon", self.HUB_LON), 6),
                "altitude_m":       round(d.get("altitude", 120.0), 1),
                "speed_kmh":        round(d.get("speed", 45.0), 1),
                "wind_gust_ms":     round(d.get("wind_gust", 4.0), 1),
                "heading_deg":      round(d.get("heading", 0.0), 1),
                "fsi":              round(d.get("fsi", 85.0), 2),
                "action_status":    d.get("action_status", "SAFE"),
                "order_id":         d.get("order_id", "STANDBY"),
                "destination_name": d.get("destination_name", "Mumbai Airspace"),
                "agent_name":       d.get("agent_name", "Logistics Officer"),
                "payload_kg":       d.get("payload_kg", 0.0),
                "dest_lat":         d.get("dest_lat"),
                "dest_lng":         d.get("dest_lon"),
                "flight_path":      d.get("flight_path", []),
                "algorithm":        d.get("algorithm", "A* (A-Star Shortest Path)"),
                "redzones_avoided": d.get("redzones_avoided", []),
            }
            for d in self.drones
        ]

    def assign_mission(self, drone_id: str, mission_data: dict) -> Optional[Tuple[dict, dict]]:
        """Assign customer order, destination, and agent to an active drone using A* shortest path."""
        for drone in self.drones:
            if drone["id"] == drone_id:
                # ── ENFORCE STRICT IN-USE PROTECTION ──
                current_status = drone.get("status", "STANDBY")
                has_active_order = drone.get("order_id") and drone["order_id"] not in ["STANDBY", "IDLE", "COMPLETED", "DELIVERED", ""]
                in_use_statuses = ["DELIVERING", "IN_FLIGHT", "RETURNING", "RTB", "PARACHUTE_DEPLOYED"]
                if current_status in in_use_statuses or has_active_order:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Drone '{drone_id}' is currently in-use (Status: {current_status}, Order: {drone.get('order_id')}). Drones cannot be assigned to another delivery until they complete their mission and return to STANDBY."
                    )

                dest_lat = float(mission_data["destination"]["lat"])
                dest_lon = float(mission_data["destination"]["lng"])
                dest_lat, dest_lon = self.make_safe_coordinates(dest_lat, dest_lon, 0.4)

                # Launch from MMR Central Hub
                drone["lat"] = self.HUB_LAT + random.uniform(-0.002, 0.002)
                drone["lon"] = self.HUB_LON + random.uniform(-0.002, 0.002)

                drone["dest_lat"] = dest_lat
                drone["dest_lon"] = dest_lon
                drone["order_id"] = mission_data.get("order_id", f"ORD-{random.randint(1000, 9999)}")
                drone["destination_name"] = mission_data["destination"].get("name", "Customer Drop Point")
                drone["agent_name"] = mission_data.get("agent_name", "Dispatch Officer")
                drone["payload_kg"] = float(mission_data.get("payload_kg", 2.0))
                drone["status"] = "DELIVERING"
                drone["mission_start_time"] = time.strftime("%H:%M:%S")
                drone["battery"] = max(drone.get("battery", 100.0), 92.0)
                drone["speed"] = random.uniform(50.0, 65.0)
                drone["altitude"] = random.uniform(95.0, 120.0)
                live_wind = weather_service.get_live_wind(dest_lat, dest_lon)
                drone["wind_gust"] = round(live_wind + random.uniform(-0.2, 0.2), 1)

                # ── EXECUTE A* SHORTEST PATHFINDING ALGORITHM ──
                origin_pt = (drone["lat"], drone["lon"])
                dest_pt = (dest_lat, dest_lon)
                astar = AStarRouteOptimizer(
                    origin=origin_pt,
                    destination=dest_pt,
                    wind_speed=drone["wind_gust"],
                    payload_weight=drone["payload_kg"],
                    safety_margin_km=0.4,
                )
                astar_res = astar.optimize()

                drone["flight_path"] = astar_res["waypoints"]
                drone["path_index"] = 0
                drone["algorithm"] = "A* (A-Star Shortest Path)"
                drone["redzones_avoided"] = astar_res.get("redzones_avoided", [])
                drone["total_distance_km"] = astar_res.get("total_distance_km", 0.0)

                # Record in active missions
                self.active_missions[drone["order_id"]] = {
                    "order_id": drone["order_id"],
                    "drone_id": drone["id"],
                    "drone_model": drone["model"],
                    "agent_name": drone["agent_name"],
                    "destination_name": drone["destination_name"],
                    "dest_lat": dest_lat,
                    "dest_lng": dest_lon,
                    "payload_kg": drone["payload_kg"],
                    "status": "EN_ROUTE",
                    "algorithm": "A*",
                    "redzones_avoided": drone["redzones_avoided"],
                    "total_distance_km": drone["total_distance_km"],
                    "dispatched_at": drone["mission_start_time"],
                    "start_battery_pct": round(drone["battery"], 1),
                }
                return drone, astar_res
        return None

    def get_missions_summary(self) -> dict:
        """Return real-time active delivery missions and verified delivery logs."""
        active_list = []
        for d in self.drones:
            if d.get("order_id") and d.get("status") in ["DELIVERING", "RETURNING"]:
                dist_rem = round(haversine(d["lat"], d["lon"], d.get("dest_lat", d["lat"]), d.get("dest_lon", d["lon"])), 2)
                total_d = round(haversine(self.HUB_LAT, self.HUB_LON, d.get("dest_lat", d["lat"]), d.get("dest_lon", d["lon"])), 2)
                progress = max(5, min(98, int((1 - (dist_rem / max(total_d, 0.1))) * 100))) if total_d > 0 else 50
                active_list.append({
                    "order_id": d.get("order_id"),
                    "drone_id": d["id"],
                    "drone_model": d["model"],
                    "agent_name": d.get("agent_name", "Dispatch Officer"),
                    "destination_name": d.get("destination_name", "Customer Location"),
                    "dest_lat": d.get("dest_lat"),
                    "dest_lng": d.get("dest_lon"),
                    "current_lat": round(d["lat"], 5),
                    "current_lng": round(d["lon"], 5),
                    "payload_kg": d.get("payload_kg", 2.0),
                    "battery_pct": round(d["battery"], 1),
                    "speed_kmh": round(d["speed"], 1),
                    "altitude_m": round(d["altitude"], 1),
                    "fsi": round(d.get("fsi", 85.0), 1),
                    "status": "EN_ROUTE",
                    "progress_pct": progress,
                    "dist_remaining_km": dist_rem,
                    "dispatched_at": d.get("mission_start_time", "Recent"),
                    "algorithm": d.get("algorithm", "A*"),
                    "redzones_avoided": d.get("redzones_avoided", []),
                })

        # Only count truly delivered (not aborted) for success stats
        true_delivered = [m for m in self.delivered_missions if m.get("status") == "DELIVERED"]
        aborted_count = len(self.delivered_missions) - len(true_delivered)
        total_completed = len(self.delivered_missions)
        success_rate = round((len(true_delivered) / total_completed * 100), 1) if total_completed > 0 else 100.0
        return {
            "active_missions": active_list,
            "delivered_missions": self.delivered_missions,
            "stats": {
                "total_dispatched": len(active_list) + len(self.delivered_missions),
                "currently_active": len(active_list),
                "delivered_count": len(true_delivered),
                "aborted_count": aborted_count,
                "success_rate": success_rate,
            }
        }

    def tick(self) -> List[dict]:
        """Advance simulation by 1 second following A* optimal waypoints with active NFZ geofence safeguard."""
        engine = get_fuzzy_engine()
        updated = []

        for drone in self.drones:
            status = drone.get("status", "STANDBY")

            # ── 1. PARACHUTE DEPLOYED (Controlled crash, emergency frozen on ground) ──
            if status == "PARACHUTE_DEPLOYED":
                drone["speed"] = 0.0
                drone["altitude"] = 0.0
                drone["wind_gust"] = round(weather_service.get_live_wind(), 1)
                drone["action_status"] = "CRITICAL"
                drone["fsi"] = 5.0
                updated.append({
                    "id":               drone["id"],
                    "model":            drone["model"],
                    "lat":              round(drone["lat"], 6),
                    "lng":              round(drone["lon"], 6),
                    "altitude_m":       0.0,
                    "battery_pct":      round(drone["battery"], 1),
                    "speed_kmh":        0.0,
                    "wind_gust_ms":     round(drone["wind_gust"], 1),
                    "heading_deg":      round(drone.get("heading", 0.0), 1),
                    "fsi":              5.0,
                    "action_status":    "CRITICAL",
                    "status":           "PARACHUTE_DEPLOYED",
                    "order_id":         drone.get("order_id", "EMERGENCY_HALT"),
                    "destination_name": drone.get("destination_name", "Parachute Crash Site"),
                    "agent_name":       drone.get("agent_name", "Safety Recovery Team"),
                    "payload_kg":       drone.get("payload_kg", 0.0),
                    "dest_lat":         drone.get("dest_lat"),
                    "dest_lng":         drone.get("dest_lon"),
                    "flight_path":      [],
                    "algorithm":        "Parachute Emergency Halt",
                    "redzones_avoided": [],
                    "timestamp":        time.time(),
                })
                continue

            # ── 2. STANDBY / IDLE (Stationed on launchpad at MMR Central Hub) ──
            if status in ["STANDBY", "IDLE"]:
                drone["speed"] = 0.0
                drone["altitude"] = 0.0
                drone["battery"] = min(100.0, drone["battery"] + 0.3)  # Charging at hub dock
                live_wind = weather_service.get_live_wind()
                drone["wind_gust"] = round(max(0.5, live_wind + random.gauss(0, 0.15)), 1)
                drone["heading"] = 0.0
                drone["fsi"] = 98.0
                drone["action_status"] = "SAFE"
                updated.append({
                    "id":               drone["id"],
                    "model":            drone["model"],
                    "lat":              round(drone["lat"], 6),
                    "lng":              round(drone["lon"], 6),
                    "altitude_m":       0.0,
                    "battery_pct":      round(drone["battery"], 1),
                    "speed_kmh":        0.0,
                    "wind_gust_ms":     round(drone["wind_gust"], 1),
                    "heading_deg":      0.0,
                    "fsi":              98.0,
                    "action_status":    "SAFE",
                    "status":           status,
                    "order_id":         "STANDBY",
                    "destination_name": "MMR Central Hub (Launchpad Standby)",
                    "agent_name":       drone.get("agent_name", "Ground Operations"),
                    "payload_kg":       0.0,
                    "dest_lat":         self.HUB_LAT,
                    "dest_lng":         self.HUB_LON,
                    "flight_path":      [],
                    "algorithm":        "Stationary",
                    "redzones_avoided": [],
                    "timestamp":        time.time(),
                })
                continue

            # ── 3. AIRBORNE / IN MOTION (DELIVERING, RETURNING, RTB, IN_FLIGHT) ──
            dest_lat = float(drone.get("dest_lat") or self.HUB_LAT)
            dest_lon = float(drone.get("dest_lon") or self.HUB_LON)

            path = drone.get("flight_path", [])
            path_idx = drone.get("path_index", 0)

            if path and path_idx < len(path) and status in ["DELIVERING", "RETURNING", "RTB"]:
                target_pt = path[path_idx]
                target_lat = float(target_pt["lat"] if isinstance(target_pt, dict) else target_pt[0])
                target_lon = float(target_pt["lng"] if isinstance(target_pt, dict) else target_pt[1])
            else:
                target_lat = dest_lat
                target_lon = dest_lon

            dlat = target_lat - drone["lat"]
            dlon = target_lon - drone["lon"]
            dist = math.hypot(dlat, dlon)

            step = 0.0022  # ~220 m per tick
            if dist < step:
                # Reached this waypoint
                if path and path_idx < len(path) - 1:
                    drone["path_index"] = path_idx + 1
                else:
                    # Arrived at destination
                    if status == "DELIVERING":
                        if drone.get("order_id") and drone["order_id"] in self.active_missions:
                            mission = self.active_missions.pop(drone["order_id"])
                            mission["status"] = "DELIVERED"
                            mission["delivered_at"] = time.strftime("%H:%M:%S")
                            mission["final_battery_pct"] = round(drone["battery"], 1)
                            mission["distance_km"] = round(haversine(self.HUB_LAT, self.HUB_LON, dest_lat, dest_lon), 2)
                            self.delivered_missions.insert(0, mission)
                            try:
                                asyncio.create_task(db_manager.mark_mission_delivered(mission["order_id"], mission))
                            except Exception:
                                pass

                        # Completed delivery, return to MMR Central Hub normally (Yellow)
                        drone["status"] = "RETURNING"
                        drone["emergency_rtb"] = False
                        drone["dest_lat"] = self.HUB_LAT
                        drone["dest_lon"] = self.HUB_LON
                        drone["destination_name"] = "MMR Central Hub (Return)"
                        if path:
                            return_path = list(reversed(path))
                            drone["flight_path"] = return_path
                            drone["path_index"] = 1 if len(return_path) > 1 else 0
                        else:
                            drone["flight_path"] = []
                            drone["path_index"] = 0
                    elif status in ["RETURNING", "RTB"]:
                        # Arrived back at Hub launchpad
                        drone["status"] = "STANDBY"
                        drone["order_id"] = "STANDBY"
                        drone["dest_lat"] = self.HUB_LAT
                        drone["dest_lon"] = self.HUB_LON
                        drone["flight_path"] = []
                        drone["path_index"] = 0
                        drone["destination_name"] = "MMR Central Hub (Ready)"
                        drone["battery"] = min(100.0, drone["battery"] + 2.5)
                        drone["speed"] = 0.0
                        drone["altitude"] = 0.0
            else:
                step_lat = (dlat / dist) * step
                step_lon = (dlon / dist) * step
                drone["heading"] = (math.degrees(math.atan2(dlon, dlat)) + 360) % 360

                # Active geofence avoidance
                repel_lat = 0.0
                repel_lon = 0.0
                buffer_zone_km = 0.75

                for zone in NO_FLY_ZONES:
                    clat, clon = zone["center"]
                    dist_km = haversine(drone["lat"], drone["lon"], clat, clon)
                    threshold_km = zone["radius_km"] + buffer_zone_km
                    if dist_km < threshold_km:
                        away_lat = drone["lat"] - clat
                        away_lon = drone["lon"] - clon
                        away_mag = math.hypot(away_lat, away_lon) or 1e-6
                        penetration = (threshold_km - dist_km) / threshold_km
                        repel_force = (penetration ** 1.4) * 0.0018
                        repel_lat += (away_lat / away_mag) * repel_force
                        repel_lon += (away_lon / away_mag) * repel_force

                next_lat = drone["lat"] + step_lat + repel_lat
                next_lon = drone["lon"] + step_lon + repel_lon

                for zone in NO_FLY_ZONES:
                    clat, clon = zone["center"]
                    dist_km = haversine(next_lat, next_lon, clat, clon)
                    hard_limit_km = zone["radius_km"] + 0.2
                    if dist_km < hard_limit_km:
                        away_lat = next_lat - clat
                        away_lon = next_lon - clon
                        away_mag = math.hypot(away_lat, away_lon) or 1e-6
                        deg_push = ((hard_limit_km - dist_km) / 111.0) + 0.0015
                        next_lat += (away_lat / away_mag) * deg_push
                        next_lon += (away_lon / away_mag) * deg_push

                drone["lat"] = next_lat
                drone["lon"] = next_lon

            # In-flight flight dynamics (DGCA Green Zone cruising corridor: 80-115m AGL)
            target_alt = 100.0
            current_alt = drone.get("altitude", target_alt)
            alt_correction = (target_alt - current_alt) * 0.05
            drone["altitude"]  = max(75.0, min(118.0, current_alt + alt_correction + random.gauss(0, 0.5)))
            drone["battery"]   = max(5.0,  drone["battery"] - random.uniform(0.04, 0.12))
            drone["speed"]     = max(25.0, min(80.0, drone.get("speed", 55.0) + random.gauss(0, 1.5)))

            # ── PHYSICAL ORNSTEIN-UHLENBECK MEAN-REVERSION TO REAL OPEN-METEO WEATHER ──
            live_wind = weather_service.get_live_wind(drone["lat"], drone["lon"])
            target_gust = live_wind * 1.10  # ~10% wind shear at 100m cruising altitude
            curr_gust = drone.get("wind_gust", target_gust)
            # Revert smoothly toward real weather target, preventing unbounded random walk drift
            drone["wind_gust"] = round(max(1.0, min(25.0, curr_gust + 0.12 * (target_gust - curr_gust) + random.gauss(0, 0.25))), 1)

            dist_hub = haversine(drone["lat"], drone["lon"], self.HUB_LAT, self.HUB_LON)

            # Evaluate real fuzzy flight safety index
            fsi_result = engine.evaluate(
                wind_gust       = drone["wind_gust"],
                battery_level   = drone["battery"],
                distance_to_hub = dist_hub,
            )
            drone["fsi"]           = fsi_result["safety_index"]
            drone["action_status"] = fsi_result["action_status"]

            if drone["battery"] < 20.0 and drone["status"] != "PARACHUTE_DEPLOYED":
                drone["status"] = "RTB"

            updated.append({
                "id":               drone["id"],
                "model":            drone["model"],
                "lat":              round(drone["lat"], 6),
                "lng":              round(drone["lon"], 6),
                "altitude_m":       round(drone["altitude"], 1),
                "battery_pct":      round(drone["battery"], 1),
                "speed_kmh":        round(drone["speed"], 1),
                "wind_gust_ms":     round(drone["wind_gust"], 1),
                "heading_deg":      round(drone["heading"], 1),
                "fsi":              round(drone["fsi"], 2),
                "action_status":    drone["action_status"],
                "status":           drone["status"],
                "order_id":         drone.get("order_id", "STANDBY"),
                "destination_name": drone.get("destination_name", "Mumbai Airspace"),
                "agent_name":       drone.get("agent_name", "Logistics Agent"),
                "payload_kg":       drone.get("payload_kg", 0.0),
                "dest_lat":         drone.get("dest_lat"),
                "dest_lng":         drone.get("dest_lon"),
                "flight_path":      drone.get("flight_path", []),
                "algorithm":        drone.get("algorithm", "A* (A-Star Shortest Path)"),
                "redzones_avoided": drone.get("redzones_avoided", []),
                "timestamp":        time.time(),
            })

        return updated


_simulator = DroneSimulator()


# ===========================================================================
# EMERGENCY CONTROLS
# ===========================================================================

@app.post("/api/emergency-rtb/{drone_id}", tags=["Emergency Controls"])
async def emergency_rtb(drone_id: str):
    """
    EMERGENCY — Return to Base (RTB).
    Immediately aborts the active delivery mission and re-routes the drone
    back to MMR Central Hub via A* shortest safe path.
    Only valid for drones currently DELIVERING.
    """
    drone = _simulator.get_drone(drone_id)
    if not drone:
        raise HTTPException(status_code=404, detail=f"Drone '{drone_id}' not found in active fleet.")

    if drone.get("status") not in ["DELIVERING", "IN_FLIGHT", "RETURNING"]:
        raise HTTPException(
            status_code=400,
            detail=f"Drone '{drone_id}' is not active (status: {drone.get('status')}). RTB only valid for DELIVERING drones."
        )

    # Record the aborted mission
    order_id = drone.get("order_id", "")
    if order_id and order_id in _simulator.active_missions:
        mission = _simulator.active_missions.pop(order_id)
        mission["status"] = "ABORTED_RTB"
        mission["aborted_at"] = time.strftime("%H:%M:%S")
        mission["abort_reason"] = "EMERGENCY_RTB_COMMAND"
        _simulator.delivered_missions.insert(0, mission)
        try:
            await db_manager.mark_mission_delivered(order_id, mission)
        except Exception:
            pass

    # Compute A* return path from current position to hub
    origin_pt = (drone["lat"], drone["lon"])
    hub_pt = (DroneSimulator.HUB_LAT, DroneSimulator.HUB_LON)
    astar = AStarRouteOptimizer(
        origin=origin_pt,
        destination=hub_pt,
        wind_speed=drone.get("wind_gust", 5.0),
        payload_weight=0.0,          # Dropping payload on RTB
        safety_margin_km=0.4,
    )
    rtb_result = astar.optimize()

    # Update drone state to emergency RTB
    drone["status"] = "RTB"
    drone["dest_lat"] = DroneSimulator.HUB_LAT
    drone["dest_lon"] = DroneSimulator.HUB_LON
    drone["destination_name"] = "MMR Central Hub (Emergency RTB)"
    drone["flight_path"] = rtb_result["waypoints"]
    drone["path_index"] = 0
    drone["algorithm"] = "A* (Emergency RTB)"
    drone["emergency_rtb"] = True
    drone["payload_kg"] = 0.0

    return {
        "status": "RTB_INITIATED",
        "drone_id": drone_id,
        "message": f"Emergency RTB initiated for {drone_id}. Drone is returning to MMR Central Hub via A* safe route.",
        "rtb_distance_km": rtb_result.get("total_distance_km", 0.0),
        "eta_minutes": rtb_result.get("estimated_eta_minutes", 0.0),
        "waypoints": len(rtb_result["waypoints"]),
        "redzones_avoided": rtb_result.get("redzones_avoided", []),
        "aborted_order": order_id,
    }


@app.post("/api/parachute-deploy/{drone_id}", tags=["Emergency Controls"])
async def parachute_deploy(drone_id: str):
    """
    EMERGENCY — Parachute Deployment (Controlled Crash Landing).
    Immediately stops drone propulsion and deploys the emergency parachute.
    Drone is marked PARACHUTE_DEPLOYED and removed from active simulation.
    Use ONLY when crash is imminent (critically low battery, hardware failure).
    """
    drone = _simulator.get_drone(drone_id)
    if not drone:
        raise HTTPException(status_code=404, detail=f"Drone '{drone_id}' not found in active fleet.")

    if drone.get("status") not in ["DELIVERING", "IN_FLIGHT", "RETURNING", "RTB"]:
        raise HTTPException(
            status_code=400,
            detail=f"Drone '{drone_id}' is not airborne (status: {drone.get('status')}). Parachute only valid for airborne drones."
        )

    order_id = drone.get("order_id", "")
    deploy_lat = round(drone["lat"], 5)
    deploy_lng = round(drone["lon"], 5)

    # Abort active mission if any
    if order_id and order_id in _simulator.active_missions:
        mission = _simulator.active_missions.pop(order_id)
        mission["status"] = "PARACHUTE_ABORT"
        mission["aborted_at"] = time.strftime("%H:%M:%S")
        mission["abort_reason"] = "PARACHUTE_DEPLOYED"
        mission["parachute_lat"] = deploy_lat
        mission["parachute_lng"] = deploy_lng
        _simulator.delivered_missions.insert(0, mission)
        try:
            await db_manager.mark_mission_delivered(order_id, mission)
        except Exception:
            pass

    # Mark drone as parachute-deployed and freeze it in simulator
    drone["status"] = "PARACHUTE_DEPLOYED"
    drone["speed"] = 0.0
    drone["altitude"] = 0.0
    drone["parachute_deployed"] = True
    drone["parachute_at"] = time.strftime("%H:%M:%S")
    drone["flight_path"] = []
    drone["path_index"] = 0
    drone["order_id"] = "PARACHUTE"
    drone["destination_name"] = f"⛑️ Parachute Deploy Site ({deploy_lat}, {deploy_lng})"

    return {
        "status": "PARACHUTE_DEPLOYED",
        "drone_id": drone_id,
        "message": f"⛑️ Parachute deployed for {drone_id}. Drone is descending under emergency parachute at ({deploy_lat}, {deploy_lng}). Recovery team dispatched.",
        "deploy_lat": deploy_lat,
        "deploy_lng": deploy_lng,
        "battery_at_deploy": round(drone.get("battery", 0.0), 1),
        "aborted_order": order_id,
        "timestamp": time.strftime("%H:%M:%S"),
    }


# ===========================================================================
# WEBSOCKET — LIVE TELEMETRY
# ===========================================================================

class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
_telemetry_task: asyncio.Task | None = None


async def telemetry_broadcast_loop():
    """Broadcast telemetry to all connected clients every second."""
    while True:
        await asyncio.sleep(1)
        telemetry = _simulator.tick()
        weather_summary = weather_service.get_live_weather_summary()
        await manager.broadcast({
            "type":    "telemetry",
            "drones":  telemetry,
            "hub":     {"lat": DroneSimulator.HUB_LAT, "lng": DroneSimulator.HUB_LON},
            "weather": weather_summary,
            "server_time": time.time(),
        })



@app.websocket("/ws/telemetry")
async def ws_telemetry(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial snapshot immediately upon connect
        await websocket.send_json({
            "type": "telemetry",
            "drones": _simulator.tick(),
            "hub": {"lat": DroneSimulator.HUB_LAT, "lng": DroneSimulator.HUB_LON},
            "weather": weather_service.get_live_weather_summary(),
            "server_time": time.time(),
        })
    except Exception:
        pass
    try:
        while True:
            # Keep connection alive indefinitely; listen for client commands & heartbeats
            data = await websocket.receive_text()
            if data == "PING":
                await websocket.send_text("PONG")
            elif data == "SIMULATE_STORM":
                for d in _simulator.drones:
                    d["wind_gust"] = random.uniform(22, 28)
            elif data in ["CLEAR_STORM", "RESET_WEATHER"]:
                live_w = weather_service.get_live_wind()
                for d in _simulator.drones:
                    d["wind_gust"] = live_w
            elif data == "FORCE_RTB":
                for d in _simulator.drones:
                    d["battery"]  = 15.0
                    d["status"]   = "RTB"
            elif data == "RESET":
                _simulator._init_fleet()
                await db_manager.clear_fleet()
                await db_manager.seed_default_drones(_simulator.DEFAULT_FLEET)
                await manager.broadcast({
                    "type": "telemetry",
                    "drones": _simulator.tick(),
                    "hub": {"lat": DroneSimulator.HUB_LAT, "lng": DroneSimulator.HUB_LON},
                    "weather": weather_service.get_live_weather_summary(),
                    "server_time": time.time(),
                })
            elif data == "CLEAR_FLEET":
                _simulator.clear_fleet()
                await db_manager.clear_fleet()
                await manager.broadcast({
                    "type": "telemetry",
                    "drones": [],
                    "hub": {"lat": DroneSimulator.HUB_LAT, "lng": DroneSimulator.HUB_LON},
                    "server_time": time.time(),
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


# ===========================================================================
# ENTRYPOINT
# ===========================================================================

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
