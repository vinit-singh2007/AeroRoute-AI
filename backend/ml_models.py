"""
AeroRoute - ML Models Module
Battery Consumption Estimation using XGBoost regression.
Features: payload_weight (kg), elevation_change (m), distance (km), wind_speed (m/s)
Target:  battery_drain_percent (%)
"""

import numpy as np
import pickle
import os
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

# ---------------------------------------------------------------------------
# Synthetic Training Data Generation
# ---------------------------------------------------------------------------

def _generate_training_data(n_samples: int = 1500, seed: int = 42):
    """Generate realistic synthetic drone battery consumption data."""
    rng = np.random.default_rng(seed)

    payload_weight  = rng.uniform(0.1, 5.0, n_samples)       # kg
    elevation_change = rng.uniform(-200, 500, n_samples)       # metres
    distance        = rng.uniform(0.5, 25.0, n_samples)        # km
    wind_speed      = rng.uniform(0.0, 18.0, n_samples)        # m/s

    base           = 3.0 * distance
    payload_factor = 2.0 * payload_weight
    elev_factor    = np.where(elevation_change > 0,
                              0.05 * elevation_change,
                              0.02 * np.abs(elevation_change))
    wind_factor    = np.maximum(0, 1.5 * (wind_speed - 5.0))
    noise          = rng.normal(0, 1.5, n_samples)

    battery_drain  = np.clip(base + payload_factor + elev_factor + wind_factor + noise, 2, 95)

    X = np.column_stack([payload_weight, elevation_change, distance, wind_speed])
    y = battery_drain
    return X, y


# ---------------------------------------------------------------------------
# Model Training & Persistence
# ---------------------------------------------------------------------------

MODEL_PATH = os.path.join(os.path.dirname(__file__), "battery_model.pkl")

def train_battery_model() -> Pipeline:
    """Train XGBoost-style Gradient Boosting regressor and cache to disk."""
    X, y = _generate_training_data()
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("model",  GradientBoostingRegressor(
            n_estimators=60,
            learning_rate=0.1,
            max_depth=4,
            subsample=0.85,
            random_state=42
        ))
    ])
    pipeline.fit(X, y)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(pipeline, f)
    return pipeline


def load_battery_model() -> Pipeline:
    """Load cached model, training if necessary."""
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            return pickle.load(f)
    return train_battery_model()


# ---------------------------------------------------------------------------
# Public Prediction API
# ---------------------------------------------------------------------------

_model: Pipeline | None = None

def get_model() -> Pipeline:
    global _model
    if _model is None:
        _model = load_battery_model()
    return _model


def predict_battery_drain(
    payload_weight: float,
    elevation_change: float,
    distance: float,
    wind_speed: float,
) -> dict:
    """
    Predict battery drain % for a delivery mission.

    Returns:
        dict with 'predicted_drain_percent', 'estimated_remaining_percent',
        'confidence_interval', 'risk_level'
    """
    model = get_model()
    X = np.array([[payload_weight, elevation_change, distance, wind_speed]])
    drain = float(np.clip(model.predict(X)[0], 0, 100))

    remaining = max(0.0, 100.0 - drain)
    risk = (
        "CRITICAL" if drain > 80
        else "HIGH"    if drain > 60
        else "MEDIUM"  if drain > 40
        else "LOW"
    )

    # Simple ±CI via heuristic noise estimate
    ci_lower = max(0.0, drain - 4.5)
    ci_upper = min(100.0, drain + 4.5)

    return {
        "predicted_drain_percent":   round(drain, 2),
        "estimated_remaining_percent": round(remaining, 2),
        "confidence_interval":       [round(ci_lower, 2), round(ci_upper, 2)],
        "risk_level":                risk,
        "features_used": {
            "payload_weight_kg":  payload_weight,
            "elevation_change_m": elevation_change,
            "distance_km":        distance,
            "wind_speed_ms":      wind_speed,
        }
    }
