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
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ml_models import predict_battery_drain, train_battery_model
from soft_computing import (
    GeneticRouteOptimizer,
    FuzzyFlightSafety,
    NO_FLY_ZONES,
    haversine,
    get_fuzzy_engine,
)


# ===========================================================================
# STARTUP / SHUTDOWN
# ===========================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-train ML model on startup and start live telemetry broadcast."""
    print("⚙️  AeroRoute backend starting — training battery model …")
    train_battery_model()
    print("✅  Battery model ready.")
    telemetry_task = asyncio.create_task(telemetry_broadcast_loop())
    print("🛰️  Telemetry broadcast loop active.")
    yield
    telemetry_task.cancel()
    print("👋  AeroRoute backend shutting down.")


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
    payload_weight_kg:    float = Field(default=1.0, ge=0.1, le=5.0)
    wind_speed_ms:        float = Field(default=5.0,  ge=0.0, le=30.0)
    max_battery_drain_pct: float = Field(default=80.0, ge=10.0, le=100.0)
    intermediate_stops:   Optional[List[LatLon]] = []


class BatteryPredictRequest(BaseModel):
    payload_weight_kg:    float = Field(ge=0.1, le=5.0)
    elevation_change_m:   float = Field(default=50.0)
    distance_km:          float = Field(ge=0.1, le=50.0)
    wind_speed_ms:        float = Field(default=5.0, ge=0.0, le=30.0)


class FuzzySafetyRequest(BaseModel):
    wind_gust_ms:         float = Field(ge=0.0,  le=30.0)
    battery_level_pct:    float = Field(ge=0.0,  le=100.0)
    distance_to_hub_km:   float = Field(ge=0.0,  le=20.0)


class CreateDroneRequest(BaseModel):
    id: str
    model: str = "Aero-X Heavy"
    max_payload_kg: float = 3.5
    battery_pct: float = 100.0
    lat: Optional[float] = None
    lng: Optional[float] = None


class DispatchMissionRequest(BaseModel):
    drone_id: str
    destination: LatLon
    destination_name: Optional[str] = "Customer Drop Location"
    order_id: Optional[str] = "ORD-101"
    agent_name: Optional[str] = "Delivery Agent"
    payload_weight_kg: float = 2.0


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
    """Dynamically register and launch a new drone into the fleet."""
    drone = _simulator.add_drone(req.model_dump())
    return {"status": "SUCCESS", "message": f"Drone {req.id} registered", "drone": drone}


@app.delete("/api/drones/{drone_id}", tags=["Fleet Management"])
async def delete_drone(drone_id: str):
    """Remove a drone from the active fleet."""
    _simulator.remove_drone(drone_id)
    return {"status": "SUCCESS", "message": f"Drone {drone_id} removed"}


@app.post("/api/dispatch-mission", tags=["Fleet Management"])
async def dispatch_mission(req: DispatchMissionRequest):
    """Assign an order destination and delivery agent to an active drone."""
    drone = _simulator.assign_mission(req.drone_id, {
        "destination": {"lat": req.destination.lat, "lng": req.destination.lng, "name": req.destination_name},
        "order_id": req.order_id,
        "agent_name": req.agent_name,
        "payload_kg": req.payload_weight_kg
    })
    if not drone:
        raise HTTPException(status_code=404, detail=f"Drone {req.drone_id} not found in fleet")
    return {"status": "SUCCESS", "message": f"Order {req.order_id} assigned to {req.drone_id}", "drone": drone}


@app.get("/api/missions", tags=["Fleet Management"])
async def get_missions():
    """Return all active en-route missions and delivered order history."""
    return _simulator.get_missions_summary()


@app.get("/api/no-fly-zones", tags=["Map Data"])
async def get_no_fly_zones():
    """Return all registered no-fly zones for map rendering."""
    return {"no_fly_zones": NO_FLY_ZONES}


@app.post("/api/optimize-route", tags=["Route Optimisation"])
async def optimize_route(req: OptimizeRouteRequest):
    """
    Execute the Genetic Algorithm to find optimal drone waypoints.
    Returns waypoints, battery estimate, ETA, and GA fitness history.
    """
    origin      = (req.origin.lat,      req.origin.lng)
    destination = (req.destination.lat, req.destination.lng)
    stops       = [(s.lat, s.lng) for s in (req.intermediate_stops or [])]

    optimizer = GeneticRouteOptimizer(
        origin=origin,
        destination=destination,
        intermediate_points=stops,
        payload_weight=req.payload_weight_kg,
        max_battery_drain=req.max_battery_drain_pct,
        wind_speed=req.wind_speed_ms,
    )

    # Run in thread pool to avoid blocking the event loop
    loop   = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, optimizer.optimize)

    return result


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


# ===========================================================================
# DRONE SIMULATOR — STATE
# ===========================================================================

class DroneSimulator:
    """Simulates a drone flying between two points with live telemetry (Mumbai)."""

    DEFAULT_FLEET = [
        {"id": "BOM-001", "model": "Phantom-Mumbai X7",   "max_payload_kg": 3.5},
        {"id": "BOM-002", "model": "Falcon-Marine Lite",   "max_payload_kg": 2.5},
        {"id": "BOM-003", "model": "Eagle-Harbor Pro",     "max_payload_kg": 5.0},
    ]

    # BKC (Bandra Kurla Complex) Central Logistics Hub, Mumbai
    HUB_LAT, HUB_LON = 19.0657, 72.8687

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
        for d in self.DEFAULT_FLEET:
            lat = self.HUB_LAT + random.uniform(-0.015, 0.015)
            lon = self.HUB_LON + random.uniform(-0.015, 0.015)
            dest_lat = self.HUB_LAT + random.uniform(-0.035, 0.035)
            dest_lon = self.HUB_LON + random.uniform(-0.035, 0.035)
            lat, lon = self.make_safe_coordinates(lat, lon, 0.5)
            dest_lat, dest_lon = self.make_safe_coordinates(dest_lat, dest_lon, 0.5)
            self.drones.append({
                **d,
                "lat":           lat,
                "lon":           lon,
                "altitude":      random.uniform(80, 150),
                "battery":       random.uniform(75, 100),
                "speed":         random.uniform(40, 65),
                "status":        "DELIVERING",
                "heading":       random.uniform(0, 360),
                "dest_lat":      dest_lat,
                "dest_lon":      dest_lon,
                "wind_gust":     random.uniform(2, 8),
                "fsi":           85.0,
                "action_status": "SAFE",
            })

    def add_drone(self, drone_data: dict) -> dict:
        """Register a user-defined drone with custom specs, ensuring safe spawn coordinates."""
        lat = drone_data.get("lat") or (self.HUB_LAT + random.uniform(-0.012, 0.012))
        lon = drone_data.get("lng") or (self.HUB_LON + random.uniform(-0.012, 0.012))
        lat, lon = self.make_safe_coordinates(float(lat), float(lon), 0.5)
        dest_lat, dest_lon = self.make_safe_coordinates(
            self.HUB_LAT + random.uniform(-0.03, 0.03),
            self.HUB_LON + random.uniform(-0.03, 0.03),
            0.5
        )
        new_drone = {
            "id":             drone_data["id"],
            "model":          drone_data.get("model", "Aero-X Standard"),
            "max_payload_kg": float(drone_data.get("max_payload_kg", 3.0)),
            "lat":            float(lat),
            "lon":            float(lon),
            "altitude":       random.uniform(90, 140),
            "battery":        float(drone_data.get("battery_pct", 100.0)),
            "speed":          random.uniform(45, 60),
            "status":         "DELIVERING",
            "heading":        random.uniform(0, 360),
            "dest_lat":       dest_lat,
            "dest_lon":       dest_lon,
            "wind_gust":      random.uniform(2, 6),
            "fsi":            90.0,
            "action_status":  "SAFE",
        }
        # Replace if exists, or append
        self.drones = [d for d in self.drones if d["id"] != new_drone["id"]]
        self.drones.append(new_drone)
        return new_drone

    def remove_drone(self, drone_id: str):
        """Remove a drone from the simulation."""
        self.drones = [d for d in self.drones if d["id"] != drone_id]

    def get_drones_summary(self) -> List[dict]:
        return [
            {
                "id":             d["id"],
                "model":          d["model"],
                "max_payload_kg": d.get("max_payload_kg", 3.0),
                "battery_pct":    round(d["battery"], 1),
                "status":         d.get("status", "IDLE"),
                "lat":            round(d["lat"], 5),
                "lng":            round(d["lon"], 5),
            }
            for d in self.drones
        ]

    def assign_mission(self, drone_id: str, mission_data: dict) -> Optional[dict]:
        """Assign customer order, destination, and agent to an active drone."""
        for drone in self.drones:
            if drone["id"] == drone_id:
                dest_lat = float(mission_data["destination"]["lat"])
                dest_lon = float(mission_data["destination"]["lng"])
                dest_lat, dest_lon = self.make_safe_coordinates(dest_lat, dest_lon, 0.4)
                drone["dest_lat"] = dest_lat
                drone["dest_lon"] = dest_lon
                drone["order_id"] = mission_data.get("order_id", f"ORD-{random.randint(1000, 9999)}")
                drone["destination_name"] = mission_data["destination"].get("name", "Customer Drop Point")
                drone["agent_name"] = mission_data.get("agent_name", "Dispatch Officer")
                drone["payload_kg"] = float(mission_data.get("payload_kg", 2.0))
                drone["status"] = "DELIVERING"
                drone["mission_start_time"] = time.strftime("%H:%M:%S")

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
                    "dispatched_at": drone["mission_start_time"],
                    "start_battery_pct": round(drone["battery"], 1),
                }
                return drone
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
                })

        return {
            "active_missions": active_list,
            "delivered_missions": self.delivered_missions,
            "stats": {
                "total_dispatched": len(active_list) + len(self.delivered_missions),
                "currently_active": len(active_list),
                "delivered_count": len(self.delivered_missions),
                "success_rate": 100.0,
            }
        }

    def tick(self) -> List[dict]:
        """Advance simulation by 1 second with active NFZ geofence avoidance and return updated telemetry."""
        engine = get_fuzzy_engine()
        updated = []

        for drone in self.drones:
            # Nominal step towards target
            dlat = drone["dest_lat"] - drone["lat"]
            dlon = drone["dest_lon"] - drone["lon"]
            dist = math.hypot(dlat, dlon)

            step = 0.0004  # ~40 m per tick
            if dist < step:
                # Arrived at destination — mark delivered if active
                if drone.get("order_id") and drone["order_id"] in self.active_missions:
                    mission = self.active_missions.pop(drone["order_id"])
                    mission["status"] = "DELIVERED"
                    mission["delivered_at"] = time.strftime("%H:%M:%S")
                    mission["final_battery_pct"] = round(drone["battery"], 1)
                    mission["distance_km"] = round(haversine(self.HUB_LAT, self.HUB_LON, drone["dest_lat"], drone["dest_lon"]), 2)
                    self.delivered_missions.insert(0, mission)
                drone["status"] = "RETURNING" if drone["battery"] < 35 else "DELIVERED"
            else:
                step_lat = (dlat / dist) * step
                step_lon = (dlon / dist) * step

                # ── ACTIVE GEOFENCE AVOIDANCE (Artificial Potential Field) ──
                # Repel dynamically away from any Mumbai No-Fly Zone
                repel_lat = 0.0
                repel_lon = 0.0
                buffer_zone_km = 0.75  # 750m early steering boundary outside red zone

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

                # Hard geofence guard: strictly clamp outside zone perimeter
                for zone in NO_FLY_ZONES:
                    clat, clon = zone["center"]
                    dist_km = haversine(next_lat, next_lon, clat, clon)
                    hard_limit_km = zone["radius_km"] + 0.2  # 200m strict hard boundary
                    if dist_km < hard_limit_km:
                        away_lat = next_lat - clat
                        away_lon = next_lon - clon
                        away_mag = math.hypot(away_lat, away_lon) or 1e-6
                        deg_push = ((hard_limit_km - dist_km) / 111.0) + 0.0015
                        next_lat += (away_lat / away_mag) * deg_push
                        next_lon += (away_lon / away_mag) * deg_push

                drone["lat"] = next_lat
                drone["lon"] = next_lon

            # Update telemetry
            drone["altitude"]  = max(60, min(200, drone["altitude"] + random.gauss(0, 3)))
            drone["battery"]   = max(5,  drone["battery"] - random.uniform(0.04, 0.12))
            drone["speed"]     = max(20, min(80, drone["speed"] + random.gauss(0, 2)))
            drone["wind_gust"] = max(0,  min(28, drone["wind_gust"] + random.gauss(0, 0.5)))
            drone["heading"]   = (drone["heading"] + random.gauss(0, 2)) % 360

            # Distance to hub
            dist_hub = haversine(drone["lat"], drone["lon"], self.HUB_LAT, self.HUB_LON)

            # FSI evaluation
            fsi_result = engine.evaluate(
                wind_gust       = drone["wind_gust"],
                battery_level   = drone["battery"],
                distance_to_hub = dist_hub,
            )
            drone["fsi"]           = fsi_result["safety_index"]
            drone["action_status"] = fsi_result["action_status"]

            if drone["battery"] < 20:
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
                "timestamp":        time.time(),
            })

        return updated


_simulator = DroneSimulator()


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
        await manager.broadcast({
            "type":    "telemetry",
            "drones":  telemetry,
            "hub":     {"lat": DroneSimulator.HUB_LAT, "lng": DroneSimulator.HUB_LON},
            "server_time": time.time(),
        })



@app.websocket("/ws/telemetry")
async def ws_telemetry(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive indefinitely; listen for client commands & heartbeats
            data = await websocket.receive_text()
            if data == "PING":
                await websocket.send_text("PONG")
            elif data == "SIMULATE_STORM":
                for d in _simulator.drones:
                    d["wind_gust"] = random.uniform(22, 28)
            elif data == "FORCE_RTB":
                for d in _simulator.drones:
                    d["battery"]  = 15.0
                    d["status"]   = "RTB"
            elif data == "RESET":
                _simulator._init_fleet()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


# ===========================================================================
# ENTRYPOINT
# ===========================================================================

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
