"""
Risk Scoring Module

Implements transparent, documented risk scoring for shipments under disruption.

Risk Score Formula:
    risk_score = w_delay * norm_delay
               + w_value * norm_value
               + w_coldchain * coldchain_risk
               + w_route * route_risk
               + w_priority * priority_score
               + w_fleet * fleet_availability_penalty

Weights (from settings, documented here as defaults):
    delay:          0.25  — How much of the journey is delayed
    cargo_value:    0.20  — Relative value of cargo
    cold_chain:     0.20  — Temperature sensitivity and exposure
    route_risk:     0.15  — Underlying route risk score
    priority:       0.15  — Business priority (1=critical → 0.0, 4=low → 1.0)
    fleet_avail:    0.05  — Penalty when fleet is scarce

Output levels:
    [0.0, 0.3)  → Low
    [0.3, 0.5)  → Medium
    [0.5, 0.7)  → High
    [0.7, 1.0]  → Critical
"""

from typing import Optional
from app.config.settings import settings


# Maximum expected values for normalization
MAX_DELAY_HOURS = 120.0         # 5 days
MAX_CARGO_VALUE = 50_000_000.0  # 5 crore INR
MAX_COLD_CHAIN_HOURS = 72.0     # 3 days exposure

# Priority mapping: lower number = higher priority
PRIORITY_SCORE = {1: 1.0, 2: 0.75, 3: 0.50, 4: 0.25}


def normalize(value: float, max_val: float) -> float:
    """Clip and normalize a value to [0, 1]."""
    return min(1.0, max(0.0, value / max_val))


def calculate_cold_chain_risk(
    temperature_sensitive: bool,
    required_temp_min: Optional[float],
    required_temp_max: Optional[float],
    current_temperature: Optional[float],
    estimated_additional_delay_hours: float,
) -> float:
    """
    Calculate cold-chain risk score (0.0–1.0).

    Factors:
    1. Temperature deviation from acceptable range
    2. Expected additional exposure time
    3. Whether cargo is temperature-sensitive at all

    This is a hackathon simulation model. Real cold-chain risk would
    use Arrhenius degradation models per product category.
    """
    if not temperature_sensitive:
        return 0.0

    risk = 0.0

    # Factor 1: Temperature deviation
    if current_temperature is not None and required_temp_min is not None and required_temp_max is not None:
        if current_temperature < required_temp_min:
            deviation = abs(required_temp_min - current_temperature)
        elif current_temperature > required_temp_max:
            deviation = abs(current_temperature - required_temp_max)
        else:
            deviation = 0.0
        # Normalize: max tolerable deviation ~10°C
        temp_risk = normalize(deviation, 10.0)
        risk += 0.4 * temp_risk
    else:
        # No current temp reading — assume some baseline risk
        risk += 0.2

    # Factor 2: Additional delay exposure
    delay_risk = normalize(estimated_additional_delay_hours, MAX_COLD_CHAIN_HOURS)
    risk += 0.4 * delay_risk

    # Factor 3: Cargo type sensitivity (always applies)
    risk += 0.2

    return min(1.0, round(risk, 4))


def calculate_risk_score(
    estimated_delay_hours: float,
    cargo_value: float,
    priority: int,
    temperature_sensitive: bool,
    required_temp_min: Optional[float],
    required_temp_max: Optional[float],
    current_temperature: Optional[float],
    route_risk: float,
    fleet_available_fraction: float = 1.0,
) -> tuple[float, str, float]:
    """
    Calculate comprehensive risk score for a shipment under disruption.

    Returns:
        (risk_score: float, risk_level: str, cold_chain_risk: float)
    """
    # Delay component
    delay_component = normalize(estimated_delay_hours, MAX_DELAY_HOURS)

    # Cargo value component
    value_component = normalize(cargo_value, MAX_CARGO_VALUE)

    # Cold-chain component
    cold_chain_risk = calculate_cold_chain_risk(
        temperature_sensitive,
        required_temp_min,
        required_temp_max,
        current_temperature,
        estimated_delay_hours,
    )

    # Route risk component (already 0-1)
    route_component = min(1.0, max(0.0, route_risk))

    # Priority component: priority 1 = highest risk, 4 = lowest
    priority_component = PRIORITY_SCORE.get(priority, 0.5)

    # Fleet availability penalty: scarce fleet → higher risk
    fleet_penalty = 1.0 - min(1.0, max(0.0, fleet_available_fraction))

    risk_score = (
        settings.weight_delay * delay_component
        + settings.weight_cargo_value * value_component
        + settings.weight_cold_chain * cold_chain_risk
        + settings.weight_route_risk * route_component
        + settings.weight_priority * priority_component
        + settings.weight_fleet_avail * fleet_penalty
    )

    risk_score = round(min(1.0, max(0.0, risk_score)), 4)
    risk_level = score_to_level(risk_score)

    return risk_score, risk_level, cold_chain_risk


def score_to_level(score: float) -> str:
    """Convert numeric score to descriptive level."""
    if score < 0.3:
        return "low"
    elif score < 0.5:
        return "medium"
    elif score < 0.7:
        return "high"
    else:
        return "critical"
