"""
AeroRoute - Soft Computing Engine
==================================
1. Genetic Algorithm (GA) — Multi-Point Dynamic Drone Route Optimization
   Constraints: battery capacity, no-fly zones (geofences)

2. Fuzzy Inference System (FIS) — Real-time Flight Safety Index (FSI)
   Inputs:  wind_gust (m/s), battery_level (%), distance_to_hub (km)
   Output:  safety_index (0–100), action_status
"""

import math
import random
import numpy as np
from typing import List, Tuple, Dict, Any


# ===========================================================================
# SHARED GEO UTILITIES
# ===========================================================================

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in kilometres."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi  = math.radians(lat2 - lat1)
    dlam  = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def point_to_segment_distance(px, py, ax, ay, bx, by) -> float:
    """Minimum distance from point (px,py) to line segment (ax,ay)-(bx,by)."""
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


# ===========================================================================
# NO-FLY ZONE DATA  (lat/lon polygons)
# ===========================================================================

# Mumbai No-Fly Zones (lat, lon, radius_km, name)
NO_FLY_ZONES: List[Dict] = [
    {"id": "NFZ-BOM-1", "center": (19.0896, 72.8656), "radius_km": 2.2, "name": "CSMIA International Airport Exclusion Zone"},
    {"id": "NFZ-BOM-2", "center": (18.9150, 72.8300), "radius_km": 1.5, "name": "Colaba Naval Dockyard Restricted Military Area"},
    {"id": "NFZ-BOM-3", "center": (19.0060, 72.9150), "radius_km": 1.4, "name": "BARC Trombay Nuclear Research Facility"},
    {"id": "NFZ-BOM-4", "center": (18.9430, 72.7950), "radius_km": 0.8, "name": "Malabar Hill VVIP Security Corridor"},
]


def is_in_no_fly_zone(lat: float, lon: float) -> bool:
    """Return True if (lat, lon) is inside any registered no-fly zone."""
    for zone in NO_FLY_ZONES:
        clat, clon = zone["center"]
        dist = haversine(lat, lon, clat, clon)
        if dist <= zone["radius_km"]:
            return True
    return False


def route_nfz_penalty(waypoints: List[Tuple[float, float]]) -> float:
    """Sum of NFZ violations (km inside restricted areas) for a route."""
    penalty = 0.0
    for lat, lon in waypoints:
        for zone in NO_FLY_ZONES:
            clat, clon = zone["center"]
            dist = haversine(lat, lon, clat, clon)
            if dist < zone["radius_km"]:
                penalty += (zone["radius_km"] - dist) * 100  # heavy penalty weight
    return penalty


# ===========================================================================
# GENETIC ALGORITHM — ROUTE OPTIMISATION
# ===========================================================================

class GeneticRouteOptimizer:
    """
    Optimises delivery waypoints under:
      - Minimum total distance
      - Battery constraint (max_battery_drain)
      - Geofence / No-Fly Zone avoidance
    """

    POPULATION_SIZE = 80
    GENERATIONS     = 120
    CROSSOVER_RATE  = 0.85
    MUTATION_RATE   = 0.18
    ELITE_COUNT     = 4

    def __init__(
        self,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
        intermediate_points: List[Tuple[float, float]],
        payload_weight: float = 1.0,
        max_battery_drain: float = 80.0,
        wind_speed: float = 5.0,
    ):
        self.origin      = origin
        self.destination = destination
        self.stops       = intermediate_points  # mutable waypoints
        self.payload     = payload_weight
        self.max_battery = max_battery_drain
        self.wind        = wind_speed

        # Pre-generate candidate intermediate waypoints near the straight line
        self._candidate_pool = self._build_candidate_pool()

    # -----------------------------------------------------------------------
    def _build_candidate_pool(self, n: int = 30) -> List[Tuple[float, float]]:
        """Generate random candidate waypoints near the direct path."""
        olat, olon = self.origin
        dlat, dlon = self.destination
        candidates = []
        for _ in range(n):
            t   = random.uniform(0.1, 0.9)
            lat = olat + t * (dlat - olat) + random.gauss(0, 0.008)
            lon = olon + t * (dlon - olon) + random.gauss(0, 0.010)
            candidates.append((round(lat, 6), round(lon, 6)))
        return candidates

    def _route_distance(self, route: List[Tuple[float, float]]) -> float:
        total = 0.0
        for i in range(len(route) - 1):
            total += haversine(*route[i], *route[i + 1])
        return total

    def _battery_cost(self, distance_km: float, elevation_m: float = 50.0) -> float:
        """Approximate battery drain % for a route."""
        base    = 3.0 * distance_km
        payload = 2.0 * self.payload
        wind    = max(0, 1.5 * (self.wind - 5.0))
        elev    = 0.05 * max(0, elevation_m)
        return base + payload + wind + elev

    def _fitness(self, route: List[Tuple[float, float]]) -> float:
        dist    = self._route_distance(route)
        battery = self._battery_cost(dist)
        nfz_pen = route_nfz_penalty(route)

        # Battery constraint penalty
        bat_pen = max(0, (battery - self.max_battery) * 10)

        # Lower fitness = better
        return dist + nfz_pen + bat_pen

    # -----------------------------------------------------------------------
    # GA OPERATORS
    # -----------------------------------------------------------------------

    def _random_individual(self) -> List[Tuple[float, float]]:
        n_pts = random.randint(2, 5)
        mid   = random.sample(self._candidate_pool, min(n_pts, len(self._candidate_pool)))
        return [self.origin] + mid + [self.destination]

    def _crossover(
        self,
        parent_a: List[Tuple[float, float]],
        parent_b: List[Tuple[float, float]],
    ) -> List[Tuple[float, float]]:
        """Single-point crossover on the intermediate segment."""
        a_mid = parent_a[1:-1]
        b_mid = parent_b[1:-1]
        if not a_mid or not b_mid:
            return parent_a[:]
        cut_a = random.randint(0, len(a_mid))
        cut_b = random.randint(0, len(b_mid))
        child_mid = a_mid[:cut_a] + b_mid[cut_b:]
        # Deduplicate
        child_mid = list(dict.fromkeys(child_mid))
        return [self.origin] + child_mid + [self.destination]

    def _mutate(
        self, individual: List[Tuple[float, float]]
    ) -> List[Tuple[float, float]]:
        """Randomly perturb, add, or remove an intermediate waypoint."""
        mid = individual[1:-1]
        op  = random.random()

        if op < 0.33 and mid:                         # shift a waypoint
            idx = random.randrange(len(mid))
            lat, lon = mid[idx]
            mid[idx] = (lat + random.gauss(0, 0.005),
                        lon + random.gauss(0, 0.006))
        elif op < 0.66:                               # add waypoint from pool
            mid.append(random.choice(self._candidate_pool))
        elif mid:                                     # remove a waypoint
            mid.pop(random.randrange(len(mid)))

        return [self.origin] + mid + [self.destination]

    # -----------------------------------------------------------------------

    def optimize(self) -> Dict[str, Any]:
        """Run GA and return best route with metrics."""
        # Seed population
        population = [self._random_individual() for _ in range(self.POPULATION_SIZE)]

        best_individual = None
        best_fitness    = float("inf")
        history         = []

        for gen in range(self.GENERATIONS):
            scored = sorted(population, key=self._fitness)
            gen_best_fit = self._fitness(scored[0])

            if gen_best_fit < best_fitness:
                best_fitness    = gen_best_fit
                best_individual = scored[0][:]

            history.append(round(gen_best_fit, 4))

            # Elitism
            new_pop = scored[:self.ELITE_COUNT]

            # Fill rest via crossover + mutation
            while len(new_pop) < self.POPULATION_SIZE:
                p1 = random.choice(scored[:20])
                p2 = random.choice(scored[:20])
                child = self._crossover(p1, p2) if random.random() < self.CROSSOVER_RATE else p1[:]
                if random.random() < self.MUTATION_RATE:
                    child = self._mutate(child)
                new_pop.append(child)

            population = new_pop

        # Build output
        dist_km  = self._route_distance(best_individual)
        battery  = self._battery_cost(dist_km)
        eta_min  = (dist_km / 60.0) * 60  # ~60 km/h average drone speed

        waypoints = [
            {"lat": pt[0], "lng": pt[1], "type": self._point_type(i, len(best_individual))}
            for i, pt in enumerate(best_individual)
        ]

        return {
            "waypoints":              waypoints,
            "total_distance_km":      round(dist_km, 3),
            "estimated_battery_drain": round(battery, 2),
            "estimated_eta_minutes":  round(eta_min, 1),
            "fitness_history":        history[::10],   # every 10th gen
            "generations_run":        self.GENERATIONS,
            "no_fly_zones":           NO_FLY_ZONES,
            "optimisation_status":    "SUCCESS",
        }

    @staticmethod
    def _point_type(idx: int, total: int) -> str:
        if idx == 0:       return "origin"
        if idx == total-1: return "destination"
        return "waypoint"


# ===========================================================================
# FUZZY INFERENCE SYSTEM — FLIGHT SAFETY INDEX
# ===========================================================================

class FuzzyFlightSafety:
    """
    Mamdani-style Fuzzy Inference System (manual implementation).

    Inputs:
      wind_gust    : 0–30 m/s   → Low / Moderate / High / Extreme
      battery_level: 0–100 %    → Critical / Low / Adequate / Full
      distance_hub : 0–20 km    → Near / Mid / Far

    Output:
      safety_index : 0–100      → Danger / Caution / Safe / Optimal
    """

    # ---- Membership functions (triangular / trapezoidal) ------------------

    @staticmethod
    def _tri(x: float, a: float, b: float, c: float) -> float:
        """Triangular MF."""
        if x <= a or x >= c:  return 0.0
        if x <= b:            return (x - a) / (b - a)
        return (c - x) / (c - b)

    @staticmethod
    def _trap(x: float, a: float, b: float, c: float, d: float) -> float:
        """Trapezoidal MF."""
        if x <= a or x >= d: return 0.0
        if x <= b:           return (x - a) / (b - a) if b > a else 1.0
        if x <= c:           return 1.0
        return (d - x) / (d - c) if d > c else 1.0

    # ---- Input fuzzification ----------------------------------------------

    def fuzzify_wind(self, w: float) -> Dict[str, float]:
        return {
            "low":      self._trap(w, 0, 0, 4, 7),
            "moderate": self._tri(w, 5, 10, 15),
            "high":     self._tri(w, 12, 17, 22),
            "extreme":  self._trap(w, 20, 25, 30, 30),
        }

    def fuzzify_battery(self, b: float) -> Dict[str, float]:
        return {
            "critical": self._trap(b, 0, 0, 15, 25),
            "low":      self._tri(b, 15, 30, 50),
            "adequate": self._tri(b, 40, 60, 80),
            "full":     self._trap(b, 70, 85, 100, 100),
        }

    def fuzzify_distance(self, d: float) -> Dict[str, float]:
        return {
            "near": self._trap(d, 0, 0, 3, 6),
            "mid":  self._tri(d, 4, 8, 13),
            "far":  self._trap(d, 10, 15, 20, 20),
        }

    # ---- Rule base --------------------------------------------------------
    # Returns list of (output_label, activation_strength)

    def _apply_rules(
        self,
        wind: Dict[str, float],
        battery: Dict[str, float],
        distance: Dict[str, float],
    ) -> List[Tuple[str, float]]:
        W, B, D = wind, battery, distance
        rules = [
            # (output_class, activation)
            ("optimal",  min(W["low"],     B["full"],     D["near"])),
            ("optimal",  min(W["low"],     B["adequate"], D["near"])),
            ("safe",     min(W["low"],     B["adequate"], D["mid"])),
            ("safe",     min(W["moderate"],B["full"],     D["near"])),
            ("safe",     min(W["low"],     B["full"],     D["mid"])),
            ("caution",  min(W["moderate"],B["adequate"], D["mid"])),
            ("caution",  min(W["moderate"],B["low"],      D["near"])),
            ("caution",  min(W["high"],    B["full"],     D["near"])),
            ("caution",  min(W["low"],     B["low"],      D["far"])),
            ("caution",  min(W["moderate"],B["adequate"], D["far"])),
            ("danger",   min(W["high"],    B["low"],      D["mid"])),
            ("danger",   min(W["high"],    B["adequate"], D["far"])),
            ("danger",   min(W["moderate"],B["critical"], D["mid"])),
            ("danger",   min(W["extreme"], B["adequate"], D["near"])),
            ("danger",   min(W["low"],     B["critical"], D["far"])),
            ("danger",   min(W["high"],    B["critical"], D["near"])),
            ("danger",   min(W["extreme"], B["low"],      D["far"])),
            ("danger",   min(W["extreme"], B["critical"], D["far"])),
        ]
        return [(label, strength) for label, strength in rules if strength > 0]

    # ---- Defuzzification (centroid of singleton outputs) ------------------

    OUTPUT_SINGLETONS = {
        "danger":  15.0,
        "caution": 40.0,
        "safe":    70.0,
        "optimal": 90.0,
    }

    def _defuzzify(self, activations: List[Tuple[str, float]]) -> float:
        numerator   = sum(self.OUTPUT_SINGLETONS[lbl] * strength for lbl, strength in activations)
        denominator = sum(strength for _, strength in activations)
        if denominator == 0:
            return 50.0  # default mid-safe
        return numerator / denominator

    # ---- Public method ----------------------------------------------------

    def evaluate(
        self,
        wind_gust: float,
        battery_level: float,
        distance_to_hub: float,
    ) -> Dict[str, Any]:
        """
        Evaluate FSI.

        Returns dict with:
          safety_index (0–100), action_status, contributing_factors
        """
        wind_gust       = float(np.clip(wind_gust,       0, 30))
        battery_level   = float(np.clip(battery_level,   0, 100))
        distance_to_hub = float(np.clip(distance_to_hub, 0, 20))

        W = self.fuzzify_wind(wind_gust)
        B = self.fuzzify_battery(battery_level)
        D = self.fuzzify_distance(distance_to_hub)

        activations  = self._apply_rules(W, B, D)
        safety_index = round(self._defuzzify(activations), 2)

        # Determine action status
        if safety_index >= 65:
            action_status = "SAFE"
            color         = "#22c55e"
        elif safety_index >= 35:
            action_status = "REROUTE_RECOMMENDED"
            color         = "#f59e0b"
        else:
            action_status = "EMERGENCY_RTB"
            color         = "#ef4444"

        return {
            "safety_index":   safety_index,
            "action_status":  action_status,
            "status_color":   color,
            "fuzzy_memberships": {
                "wind":     {k: round(v, 3) for k, v in W.items()},
                "battery":  {k: round(v, 3) for k, v in B.items()},
                "distance": {k: round(v, 3) for k, v in D.items()},
            },
            "rule_activations": [
                {"class": lbl, "strength": round(s, 3)}
                for lbl, s in activations
            ],
            "inputs": {
                "wind_gust_ms":      wind_gust,
                "battery_level_pct": battery_level,
                "distance_hub_km":   distance_to_hub,
            },
        }


# ===========================================================================
# MODULE-LEVEL SINGLETONS
# ===========================================================================

_fuzzy_engine: FuzzyFlightSafety | None = None

def get_fuzzy_engine() -> FuzzyFlightSafety:
    global _fuzzy_engine
    if _fuzzy_engine is None:
        _fuzzy_engine = FuzzyFlightSafety()
    return _fuzzy_engine
