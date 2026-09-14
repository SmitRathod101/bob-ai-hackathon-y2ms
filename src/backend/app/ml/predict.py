"""
ML Prediction Service — ChainMind AI

Provides delay prediction and risk classification using trained models.
Falls back to deterministic formula if models are not available.

Models are trained by: scripts/train_models.py
Stored in: ml_models/
"""

import os
import logging
import numpy as np
from typing import Optional, Tuple
from app.ml.features import extract_delay_features, extract_risk_features
from app.simulation.risk_scorer import score_to_level

logger = logging.getLogger(__name__)

_delay_model = None
_risk_model = None
_models_loaded = False

MODELS_DIR = os.getenv("ML_MODELS_DIR", "ml_models")


def load_models():
    """Attempt to load trained ML models from disk."""
    global _delay_model, _risk_model, _models_loaded

    try:
        import joblib
        delay_path = os.path.join(MODELS_DIR, "delay_model.joblib")
        risk_path = os.path.join(MODELS_DIR, "risk_model.joblib")

        if os.path.exists(delay_path):
            _delay_model = joblib.load(delay_path)
            logger.info("Loaded delay prediction model")
        if os.path.exists(risk_path):
            _risk_model = joblib.load(risk_path)
            logger.info("Loaded risk classification model")
        _models_loaded = True
    except Exception as e:
        logger.warning(f"Could not load ML models: {e}. Using deterministic fallback.")
        _models_loaded = False


def predict_delay(
    route_distance_km: float,
    route_congestion: float,
    disruption_duration_hours: float,
    severity_score: float,
    priority: int,
    route_risk: float,
    capacity_reduction: float,
    is_direct: bool,
    cargo_value: float = 0.0,
    temperature_sensitive: bool = False,
) -> float:
    """
    Predict delay in hours.
    Uses ML model if available, otherwise deterministic formula.
    """
    if _delay_model is not None:
        try:
            features = extract_delay_features(
                route_distance_km, route_congestion, disruption_duration_hours,
                severity_score, priority, route_risk, capacity_reduction,
                is_direct, cargo_value, temperature_sensitive,
            )
            pred = _delay_model.predict(features.reshape(1, -1))[0]
            return max(0.0, float(pred))
        except Exception as e:
            logger.warning(f"ML delay prediction failed: {e}, using fallback")

    # Deterministic fallback formula
    base = disruption_duration_hours * severity_score * capacity_reduction
    congestion_bonus = route_congestion * base * 0.3
    direct_factor = 1.0 if is_direct else 0.35
    return max(1.0, (base + congestion_bonus) * direct_factor)


def predict_risk_score(
    estimated_delay_hours: float,
    cargo_value: float,
    priority: int,
    temperature_sensitive: bool,
    route_risk: float,
    cold_chain_risk: float,
    severity_score: float,
    congestion: float,
) -> Tuple[float, str]:
    """
    Predict risk score and level.
    Uses ML model if available, otherwise deterministic formula.
    Returns (risk_score: float, risk_level: str)
    """
    if _risk_model is not None:
        try:
            features = extract_risk_features(
                estimated_delay_hours, cargo_value, priority,
                temperature_sensitive, route_risk, cold_chain_risk,
                severity_score, congestion,
            )
            pred_class = _risk_model.predict(features.reshape(1, -1))[0]
            proba = _risk_model.predict_proba(features.reshape(1, -1))[0]
            # Class mapping: 0=low, 1=medium, 2=high, 3=critical
            level_map = {0: "low", 1: "medium", 2: "high", 3: "critical"}
            risk_level = level_map.get(int(pred_class), "medium")
            # Use max probability as score proxy
            risk_score = float(np.dot(proba, [0.15, 0.40, 0.65, 0.90]))
            return round(risk_score, 4), risk_level
        except Exception as e:
            logger.warning(f"ML risk prediction failed: {e}, using fallback")

    # Deterministic fallback
    from app.config.settings import settings
    delay_comp = min(1.0, estimated_delay_hours / 120.0)
    value_comp = min(1.0, cargo_value / 50_000_000.0)
    priority_comp = (5 - priority) / 4.0
    score = (
        settings.weight_delay * delay_comp
        + settings.weight_cargo_value * value_comp
        + settings.weight_cold_chain * cold_chain_risk
        + settings.weight_route_risk * route_risk
        + settings.weight_priority * priority_comp
    )
    score = min(1.0, max(0.0, score))
    return round(score, 4), score_to_level(score)


def get_model_status() -> dict:
    """Return the current model loading status."""
    return {
        "delay_model_loaded": _delay_model is not None,
        "risk_model_loaded": _risk_model is not None,
        "models_dir": MODELS_DIR,
        "using_ml": _delay_model is not None or _risk_model is not None,
    }
