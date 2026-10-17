"""
AeroRoute — MongoDB Database Layer
===================================
Provides asynchronous MongoDB persistence using Motor for:
- Fleet & Drone Registrations (drones collection)
- Real-time & Historical Delivery Missions (missions collection)
- Optimized Flight Routes & GA logs (routes collection)
- Telemetry & Flight History snapshots (telemetry_logs collection)
"""

import os
import time
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "aeroroute_db")


class DatabaseManager:
    client: Optional[AsyncIOMotorClient] = None
    db: Any = None
    connected: bool = False
    server_info: Dict[str, Any] = {}

    async def connect(self):
        """Establish asynchronous connection to MongoDB and ensure indexes."""
        try:
            print(f"[*] Connecting to MongoDB at {MONGODB_URL} ...")
            self.client = AsyncIOMotorClient(
                MONGODB_URL,
                serverSelectionTimeoutMS=3000,
                connectTimeoutMS=3000
            )
            # Test ping
            self.server_info = await self.client.server_info()
            self.db = self.client[MONGODB_DB_NAME]
            self.connected = True
            print(f"[+] MongoDB connected successfully! (Version: {self.server_info.get('version', 'unknown')}, DB: {MONGODB_DB_NAME})")

            # Ensure indexes
            await self._create_indexes()
        except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as e:
            self.connected = False
            self.db = None
            print(f"[!] Warning: MongoDB connection failed: {e}. Running with in-memory fallback.")

    async def _create_indexes(self):
        """Ensure useful indexes exist on collections."""
        if not self.connected or self.db is None:
            return
        try:
            await self.db.drones.create_index("id", unique=True)
            await self.db.missions.create_index("order_id", unique=True)
            await self.db.missions.create_index("drone_id")
            await self.db.routes.create_index([("created_at", -1)])
        except Exception as e:
            print(f"[!] Warning: Index creation skipped: {e}")

    async def disconnect(self):
        """Close MongoDB connection gracefully."""
        if self.client:
            self.client.close()
            self.connected = False
            print("[-] MongoDB connection closed.")

    # -----------------------------------------------------------------------
    # Drone Fleet Operations
    # -----------------------------------------------------------------------

    async def get_all_drones(self) -> List[dict]:
        """Fetch all stored drones from MongoDB."""
        if not self.connected or self.db is None:
            return []
        try:
            cursor = self.db.drones.find({}, {"_id": 0})
            return await cursor.to_list(length=200)
        except Exception as e:
            print(f"[!] DB get_all_drones error: {e}")
            return []

    async def upsert_drone(self, drone_data: dict) -> bool:
        """Upsert a drone into the fleet collection."""
        if not self.connected or self.db is None:
            return False
        try:
            drone_id = drone_data["id"]
            doc = {
                "id": drone_id,
                "model": drone_data.get("model", "Aero-X Standard"),
                "max_payload_kg": float(drone_data.get("max_payload_kg", 3.0)),
                "battery_pct": float(drone_data.get("battery", drone_data.get("battery_pct", 100.0))),
                "status": drone_data.get("status", "IDLE"),
                "lat": float(drone_data.get("lat", 19.0760)),
                "lng": float(drone_data.get("lon", drone_data.get("lng", 72.8777))),
                "updated_at": time.time(),
            }
            await self.db.drones.update_one(
                {"id": drone_id},
                {"$set": doc},
                upsert=True
            )
            return True
        except Exception as e:
            print(f"[!] DB upsert_drone error: {e}")
            return False

    async def remove_drone(self, drone_id: str) -> bool:
        """Delete a drone by id from the database."""
        if not self.connected or self.db is None:
            return False
        try:
            await self.db.drones.delete_one({"id": drone_id})
            return True
        except Exception as e:
            print(f"[!] DB remove_drone error: {e}")
            return False

    async def clear_fleet(self) -> bool:
        """Clear all drones from the database."""
        if not self.connected or self.db is None:
            return False
        try:
            await self.db.drones.delete_many({})
            return True
        except Exception as e:
            print(f"[!] DB clear_fleet error: {e}")
            return False

    async def seed_default_drones(self, default_fleet: List[dict]):
        """Seed default drones if drones collection is currently empty."""
        if not self.connected or self.db is None:
            return
        try:
            count = await self.db.drones.count_documents({})
            if count == 0:
                print("[*] Seeding default drone fleet in MongoDB...")
                for d in default_fleet:
                    await self.upsert_drone(d)
        except Exception as e:
            print(f"[!] DB seed_default_drones error: {e}")

    # -----------------------------------------------------------------------
    # Mission Operations
    # -----------------------------------------------------------------------

    async def save_mission(self, mission_data: dict) -> bool:
        """Upsert a mission document."""
        if not self.connected or self.db is None:
            return False
        try:
            order_id = mission_data.get("order_id")
            if not order_id:
                return False
            doc = {**mission_data, "updated_at": time.time()}
            await self.db.missions.update_one(
                {"order_id": order_id},
                {"$set": doc},
                upsert=True
            )
            return True
        except Exception as e:
            print(f"[!] DB save_mission error: {e}")
            return False

    async def mark_mission_delivered(self, order_id: str, delivered_data: dict) -> bool:
        """Update mission status to DELIVERED."""
        if not self.connected or self.db is None:
            return False
        try:
            updates = {
                "status": "DELIVERED",
                "delivered_at": delivered_data.get("delivered_at", time.strftime("%H:%M:%S")),
                "final_battery_pct": delivered_data.get("final_battery_pct"),
                "distance_km": delivered_data.get("distance_km"),
                "updated_at": time.time(),
            }
            await self.db.missions.update_one(
                {"order_id": order_id},
                {"$set": updates}
            )
            return True
        except Exception as e:
            print(f"[!] DB mark_mission_delivered error: {e}")
            return False

    async def get_missions(self, limit: int = 100) -> List[dict]:
        """Fetch recent missions ordered by dispatched time."""
        if not self.connected or self.db is None:
            return []
        try:
            cursor = self.db.missions.find({}, {"_id": 0}).sort("updated_at", -1).limit(limit)
            return await cursor.to_list(length=limit)
        except Exception as e:
            print(f"[!] DB get_missions error: {e}")
            return []

    # -----------------------------------------------------------------------
    # Route Optimization Logs
    # -----------------------------------------------------------------------

    async def save_route(self, route_record: dict) -> bool:
        """Store route optimization output and metadata."""
        if not self.connected or self.db is None:
            return False
        try:
            doc = {
                **route_record,
                "created_at": time.time(),
                "created_time_str": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            await self.db.routes.insert_one(doc)
            return True
        except Exception as e:
            print(f"[!] DB save_route error: {e}")
            return False

    async def get_recent_routes(self, limit: int = 20) -> List[dict]:
        """Fetch recent route optimization records."""
        if not self.connected or self.db is None:
            return []
        try:
            cursor = self.db.routes.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
            return await cursor.to_list(length=limit)
        except Exception as e:
            print(f"[!] DB get_recent_routes error: {e}")
            return []

    # -----------------------------------------------------------------------
    # DB Status & Diagnostics
    # -----------------------------------------------------------------------

    async def get_db_status(self) -> dict:
        """Return database connection status and collection statistics."""
        if not self.connected or self.db is None:
            return {
                "status": "DISCONNECTED",
                "mongodb_url": MONGODB_URL,
                "database": MONGODB_DB_NAME,
                "version": None,
                "counts": {"drones": 0, "missions": 0, "routes": 0},
            }
        try:
            drones_count = await self.db.drones.count_documents({})
            missions_count = await self.db.missions.count_documents({})
            routes_count = await self.db.routes.count_documents({})
            return {
                "status": "CONNECTED",
                "mongodb_url": MONGODB_URL.split("@")[-1] if "@" in MONGODB_URL else MONGODB_URL,
                "database": MONGODB_DB_NAME,
                "version": self.server_info.get("version", "8.x"),
                "counts": {
                    "drones": drones_count,
                    "missions": missions_count,
                    "routes": routes_count,
                },
            }
        except Exception as e:
            return {
                "status": "ERROR",
                "error": str(e),
                "mongodb_url": MONGODB_URL,
                "database": MONGODB_DB_NAME,
            }


db_manager = DatabaseManager()
