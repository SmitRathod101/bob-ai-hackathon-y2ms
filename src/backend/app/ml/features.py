"""
ML Feature Engineering — ChainMind AI

Features for delay prediction and risk classification models.
"""

import numpy as np
from typing import Dict, Any


DELAY_FEATURE_NAMES = [
    "route_distance_km_norm",
    "route_congestion",
    "disruption_duration_norm",
    "severity_score",
    "priority_inv",        # inverted: 1=low priority, 4=high priority (inv)
    "route_risk",
    "capacity_reduction",
    "is_direct",
    "cargo_value_norm",
    "temperature_sensitive",
]

RISK_FEATURE_NAMES = [
    "estimated_delay_norm",
    "cargo_value_norm",
    "priority_inv",
    "temperature_sensitive",
    "route_risk",
    "cold_chain_risk",
    "severity_score",
    "congestion",
]


def extract_delay_features(
    route_distance_km: float,
    route_congestion: float,
    disruption_duration_hours: float,
    severity_score: float,
    priority: int,
    route_risk: float,
    capacity_reduction: float,
    is_direct: bool,
    cargo_value: float,
    temperature_sensitive: bool,
) -> np.ndarray:
    """Extract normalized features for delay prediction."""
    return np.array([
        min(1.0, route_distance_km / 2000.0),
        float(route_congestion),
        min(1.0, disruption_duration_hours / 120.0),
        float(severity_score),
        (5 - priority) / 4.0,   # invert: priority 1 → 1.0, priority 4 → 0.25
        float(route_risk),
        float(capacity_reduction),
        float(is_direct),
        min(1.0, cargo_value / 50_000_000.0),
        float(temperature_sensitive),
    ], dtype=np.float32)


def extract_risk_features(
    estimated_delay_hours: float,
    cargo_value: float,
    priority: int,
    temperature_sensitive: bool,
    route_risk: float,
    cold_chain_risk: float,
    severity_score: float,
    congestion: float,
) -> np.ndarray:
    """Extract features for risk classification."""
    return np.array([
        min(1.0, estimated_delay_hours / 120.0),
        min(1.0, cargo_value / 50_000_000.0),
        (5 - priority) / 4.0,
        float(temperature_sensitive),
        float(route_risk),
        float(cold_chain_risk),
        float(severity_score),
        float(congestion),
    ], dtype=np.float32)
