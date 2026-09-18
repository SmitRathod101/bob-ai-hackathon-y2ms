"""
Causal Condition & Event Engine — ChainMind AI Round 2

Converts environmental/operational conditions and direct disruption events
into structured disruption records that feed the existing simulation pipeline.

CAUSALITY RULES
---------------
Conditions drive disruption probability/severity deterministically:

    High rainfall (> RAIN_HIGH_MM/h)
        → flood/landslide disruption risk increases
        → road_condition degrades
        → connection may become unavailable

    Extreme temperature (> TEMP_HOT_C or < TEMP_COLD_C)
        → cold-chain exposure risk multiplier increases
        → temperature-related disruption

    High traffic (> TRAFFIC_HIGH)
        → delay multiplier increases
        → port congestion compounds

    Poor road condition (< ROAD_POOR)
        → road blockage risk increases

    High port congestion (> PORT_CONGESTION_HIGH)
        → port delay increases
        → capacity reduction

    Severe weather (> WEATHER_SEVERE)
        → severe weather disruption

All thresholds are configurable constants — NOT LLM-generated.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Causal Thresholds (configurable) ─────────────────────────────────────────

# Rainfall mm/h
RAIN_MODERATE_MM = 20.0
RAIN_HIGH_MM = 50.0
RAIN_EXTREME_MM = 100.0

# Temperature °C
TEMP_HOT_C = 42.0
TEMP_VERY_HOT_C = 48.0
TEMP_COLD_C = 2.0
TEMP_VERY_COLD_C = -5.0

# Traffic fraction (0–1)
TRAFFIC_HIGH = 0.70
TRAFFIC_SEVERE = 0.90

# Road condition (0–1, 1=perfect)
ROAD_POOR = 0.40
ROAD_CRITICAL = 0.20

# Port congestion (0–1)
PORT_CONGESTION_HIGH = 0.70
PORT_CONGESTION_CRITICAL = 0.90

# Weather severity (0–1)
WEATHER_MODERATE = 0.50
WEATHER_SEVERE = 0.75
WEATHER_EXTREME = 0.90

# Wind kmh
WIND_HIGH_KMH = 80.0
WIND_EXTREME_KMH = 120.0

# Visibility km
VISIBILITY_LOW_KM = 2.0

# ── Output Data Structures ────────────────────────────────────────────────────

@dataclass
class CausalDisruption:
    """A disruption generated (or amplified) by the causal engine."""
    disruption_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    disruption_type: str = ""          # maps to existing simulation disruption_type
    scope_type: str = "node"           # node / region / connection / route
    scope_name: str = ""               # e.g. "Mumbai", "Western Coast"
    severity: str = "medium"          # low / medium / high
    severity_score: float = 0.5
    causal_source: str = "causal_engine"
    causal_reason: str = ""
    # Simulation parameters derived by the engine
    duration_hours: float = 24.0
    capacity_reduction: float = 0.5
    delay_multiplier: float = 1.5
    cost_multiplier: float = 1.2
    temperature_risk_multiplier: float = 1.0
    # Which connections to interrupt (if any)
    interrupt_connections: List[str] = field(default_factory=list)


@dataclass
class ConditionViolation:
    """Records that a condition exceeded a threshold."""
    condition_name: str
    scope_name: str
    threshold_name: str
    value: float
    threshold_value: float
    severity: str
    consequence: str


@dataclass
class CausalEngineResult:
    """Output from the causal engine for a set of input conditions + disruptions."""
    input_conditions: List[Dict[str, Any]] = field(default_factory=list)
    input_direct_disruptions: List[Dict[str, Any]] = field(default_factory=list)
    violations: List[ConditionViolation] = field(default_factory=list)
    generated_disruptions: List[CausalDisruption] = field(default_factory=list)
    # Merged simulation scenario for the existing engine
    merged_scenario: Dict[str, Any] = field(default_factory=dict)
    # Nodes/connections to exclude from the graph
    excluded_nodes: List[str] = field(default_factory=list)
    interrupted_connection_ids: List[str] = field(default_factory=list)
    # Human-readable event log
    event_log: List[Dict[str, Any]] = field(default_factory=list)
    # Aggregated causal explanation text
    causal_narrative: str = ""


# ── Causal Rule Application ───────────────────────────────────────────────────

def _severity_from_score(score: float) -> str:
    if score >= 0.75:
        return "high"
    elif score >= 0.45:
        return "medium"
    return "low"


def _apply_condition_rules(
    condition: Dict[str, Any],
    violations: List[ConditionViolation],
    disruptions: List[CausalDisruption],
    event_log: List[Dict[str, Any]],
) -> None:
    """
    Apply causal rules to a single condition state dict.
    Mutates violations, disruptions, event_log in place.
    """
    scope = condition.get("scope_name", "Unknown")
    scope_type = condition.get("scope_type", "node")

    # ── Rule 1: Rainfall → flood / landslide ──────────────────────────────────
    rain = condition.get("rainfall_mm")
    if rain is not None:
        if rain >= RAIN_EXTREME_MM:
            score = 0.90
            sev = "high"
            reason = (
                f"Extreme rainfall ({rain:.0f} mm/h) at {scope} far exceeds the "
                f"{RAIN_EXTREME_MM:.0f} mm/h threshold. Flood and landslide risk is critical. "
                f"Roads and connections in the area may become impassable."
            )
            disruptions.append(CausalDisruption(
                disruption_type="severe_weather",
                scope_type=scope_type, scope_name=scope,
                severity=sev, severity_score=score,
                causal_reason=reason,
                duration_hours=48.0, capacity_reduction=0.90,
                delay_multiplier=2.2, temperature_risk_multiplier=1.3,
            ))
            violations.append(ConditionViolation(
                "rainfall_mm", scope, "RAIN_EXTREME_MM",
                rain, RAIN_EXTREME_MM, sev,
                "Extreme flood/landslide — connections may be unavailable"
            ))
            event_log.append({"stage": "condition_changed", "entity": scope,
                               "condition": "rainfall", "value": rain, "severity": sev,
                               "consequence": "flood/landslide disruption generated"})
        elif rain >= RAIN_HIGH_MM:
            score = 0.65
            sev = "medium"
            reason = (
                f"High rainfall ({rain:.0f} mm/h) at {scope} exceeds {RAIN_HIGH_MM:.0f} mm/h. "
                f"Landslide/flood probability elevated. Road conditions degrading."
            )
            disruptions.append(CausalDisruption(
                disruption_type="route_closure",
                scope_type=scope_type, scope_name=scope,
                severity=sev, severity_score=score,
                causal_reason=reason,
                duration_hours=24.0, capacity_reduction=0.60,
                delay_multiplier=1.6,
            ))
            violations.append(ConditionViolation(
                "rainfall_mm", scope, "RAIN_HIGH_MM",
                rain, RAIN_HIGH_MM, sev,
                "High flood/landslide risk — route degradation"
            ))
            event_log.append({"stage": "condition_changed", "entity": scope,
                               "condition": "rainfall", "value": rain, "severity": sev,
                               "consequence": "route_closure disruption generated"})

    # ── Rule 2: Temperature → cold-chain / heat disruption ───────────────────
    temp = condition.get("temperature_c")
    if temp is not None:
        if temp >= TEMP_VERY_HOT_C:
            score = 0.80
            sev = "high"
            reason = (
                f"Extreme heat ({temp:.0f}°C) at {scope} exceeds {TEMP_VERY_HOT_C:.0f}°C. "
                f"Severe cold-chain exposure risk. Temperature-sensitive cargo at critical risk."
            )
            disruptions.append(CausalDisruption(
                disruption_type="severe_weather",
                scope_type=scope_type, scope_name=scope,
                severity=sev, severity_score=score,
                causal_reason=reason,
                duration_hours=12.0, capacity_reduction=0.3,
                temperature_risk_multiplier=2.5,
            ))
            violations.append(ConditionViolation(
                "temperature_c", scope, "TEMP_VERY_HOT_C",
                temp, TEMP_VERY_HOT_C, sev, "Extreme heat — cold-chain critical"
            ))
            event_log.append({"stage": "condition_changed", "entity": scope,
                               "condition": "temperature", "value": temp, "severity": sev,
                               "consequence": "severe_weather disruption, high cold-chain risk"})
        elif temp >= TEMP_HOT_C:
            score = 0.55
            sev = "medium"
            reason = (
                f"High temperature ({temp:.0f}°C) at {scope} exceeds {TEMP_HOT_C:.0f}°C. "
                f"Cold-chain risk elevated for temperature-sensitive cargo."
            )
            disruptions.append(CausalDisruption(
                disruption_type="severe_weather",
                scope_type=scope_type, scope_name=scope,
                severity=sev, severity_score=score,
                causal_reason=reason,
                duration_hours=8.0, capacity_reduction=0.2,
                temperature_risk_multiplier=1.8,
            ))
            violations.append(ConditionViolation(
                "temperature_c", scope, "TEMP_HOT_C",
                temp, TEMP_HOT_C, sev, "High heat — cold-chain risk elevated"
            ))
            event_log.append({"stage": "condition_changed", "entity": scope,
                               "condition": "temperature", "value": temp, "severity": sev,
                               "consequence": "cold-chain risk multiplier elevated"})
        elif temp <= TEMP_VERY_COLD_C:
            score = 0.75
            sev = "high"
            reason = (
                f"Extreme cold ({temp:.0f}°C) at {scope}. "
                f"Fleet operations impaired. Cold-chain equipment risk elevated."
            )
            disruptions.append(CausalDisruption(
                disruption_type="vehicle_shortage",
                scope_type=scope_type, scope_name=scope,
                severity=sev, severity_score=score,
                causal_reason=reason,
                duration_hours=24.0, capacity_reduction=0.5,
                temperature_risk_multiplier=1.5,
            ))
            event_log.append({"stage": "condition_changed", "entity": scope,
                               "condition": "temperature", "value": temp, "severity": sev,
                               "consequence": "vehicle_shortage risk, cold chain risk"})

    # ── Rule 3: Traffic → delay ───────────────────────────────────────────────
    traffic = condition.get("traffic_level")
    if traffic is not None:
        if traffic >= TRAFFIC_SEVERE:
            score = 0.75
            sev = "high"
            reason = (
                f"Severe traffic ({traffic:.0%}) at {scope}. "
                f"Route capacity critically reduced. Major delays expected."
            )
            disruptions.append(CausalDisruption(
                disruption_type="demand_spike",
                scope_type=scope_type, scope_name=scope,
                severity=sev, severity_score=score,
                causal_reason=reason,
                duration_hours=12.0, capacity_reduction=traffic,
                delay_multiplier=2.0, cost_multiplier=1.5,
            ))
            violations.append(ConditionViolation(
                "traffic_level", scope, "TRAFFIC_SEVERE",
                traffic, TRAFFIC_SEVERE, sev, "Severe congestion — major delays"
            ))
            event_log.append({"stage": "condition_changed", "entity": scope,
                               "condition": "traffic", "value": traffic, "severity": sev,
                               "consequence": "high delay disruption generated"})
        elif traffic >= TRAFFIC_HIGH:
            score = 0.45
            sev = "medium"
            reason = f"High traffic ({traffic:.0%}) at {scope}. Moderate delays expected."
            disruptions.append(CausalDisruption(
                disruption_type="demand_spike",
                scope_type=scope_type, scope_name=scope,
                severity=sev, severity_score=score,
                causal_reason=reason,
                duration_hours=8.0, capacity_reduction=traffic * 0.7,
                delay_multiplier=1.5,
            ))
            event_log.append({"stage": "condition_changed", "entity": scope,
                               "condition": "traffic", "value": traffic, "severity": sev,
                               "consequence": "moderate delay disruption"})

    # ── Rule 4: Road condition → road blockage ────────────────────────────────
    road = condition.get("road_condition")
    if road is not None:
        if road <= ROAD_CRITICAL:
            score = 0.85
            sev = "high"
            reason = (
                f"Critical road condition ({road:.0%}) at {scope}. "
                f"Road blockage/closure imminent. Routes depending on this area affected."
            )
            disruptions.append(CausalDisruption(
                disruption_type="route_closure",
                scope_type=scope_type, scope_name=scope,
                severity=sev, severity_score=score,
                causal_reason=reason,
                duration_hours=36.0, capacity_reduction=0.9,
                delay_multiplier=2.0,
            ))
            violations.append(ConditionViolation(
                "road_condition", scope, "ROAD_CRITICAL",
                road, ROAD_CRITICAL, sev, "Critical road state — route closure"
            ))
            event_log.append({"stage": "condition_changed", "entity": scope,
                               "condition": "road_condition", "value": road, "severity": sev,
                               "consequence": "route_closure disruption"})
        elif road <= ROAD_POOR:
            score = 0.55
            sev = "medium"
            reason = f"Poor road condition ({road:.0%}) at {scope}. Route degradation probable."
            disruptions.append(CausalDisruption(
                disruption_type="route_closure",
                scope_type=scope_type, scope_name=scope,
                severity=sev, severity_score=score,
                causal_reason=reason,
                duration_hours=18.0, capacity_reduction=0.5,
                delay_multiplier=1.6,
            ))
            event_log.append({"stage": "condition_changed", "entity": scope,
                               "condition": "road_condition", "value": road, "severity": sev,
                               "consequence": "route degradation"})

    # ── Rule 5: Port congestion ───────────────────────────────────────────────
    port_cong = condition.get("port_congestion")
    if port_cong is not None:
        if port_cong >= PORT_CONGESTION_CRITICAL:
            score = 0.80
            sev = "high"
            reason = (
                f"Critical port congestion ({port_cong:.0%}) at {scope}. "
                f"Port effectively closed for new cargo. Major delays."
            )
            disruptions.append(CausalDisruption(
                disruption_type="port_closure",
                scope_type=scope_type, scope_name=scope,
                severity=sev, severity_score=score,
                causal_reason=reason,
                duration_hours=24.0, capacity_reduction=port_cong,
                delay_multiplier=2.0, cost_multiplier=1.6,
            ))
            violations.append(ConditionViolation(
                "port_congestion", scope, "PORT_CONGESTION_CRITICAL",
                port_cong, PORT_CONGESTION_CRITICAL, sev, "Port critically congested"
            ))
            event_log.append({"stage": "condition_changed", "entity": scope,
                               "condition": "port_congestion", "value": port_cong, "severity": sev,
                               "consequence": "port_closure disruption"})
        elif port_cong >= PORT_CONGESTION_HIGH:
            score = 0.55
            sev = "medium"
            reason = f"High port congestion ({port_cong:.0%}) at {scope}. Delays expected."
            disruptions.append(CausalDisruption(
                disruption_type="port_closure",
                scope_type=scope_type, scope_name=scope,
                severity=sev, severity_score=score,
                causal_reason=reason,
                duration_hours=12.0, capacity_reduction=port_cong * 0.8,
                delay_multiplier=1.6, cost_multiplier=1.3,
            ))
            event_log.append({"stage": "condition_changed", "entity": scope,
                               "condition": "port_congestion", "value": port_cong, "severity": sev,
                               "consequence": "port delay"})

    # ── Rule 6: Weather severity ──────────────────────────────────────────────
    weather = condition.get("weather_severity")
    if weather is not None:
        if weather >= WEATHER_EXTREME:
            score = 0.90
            sev = "high"
            reason = (
                f"Extreme weather severity ({weather:.0%}) at {scope}. "
                f"All operations severely impaired."
            )
            disruptions.append(CausalDisruption(
                disruption_type="severe_weather",
                scope_type=scope_type, scope_name=scope,
                severity=sev, severity_score=score,
                causal_reason=reason,
                duration_hours=48.0, capacity_reduction=0.95,
                delay_multiplier=2.2, temperature_risk_multiplier=1.5,
            ))
            violations.append(ConditionViolation(
                "weather_severity", scope, "WEATHER_EXTREME",
                weather, WEATHER_EXTREME, sev, "Extreme weather — all operations impaired"
            ))
            event_log.append({"stage": "condition_changed", "entity": scope,
                               "condition": "weather_severity", "value": weather, "severity": sev,
                               "consequence": "severe_weather disruption (extreme)"})
        elif weather >= WEATHER_SEVERE:
            score = 0.70
            sev = "high"
            reason = f"Severe weather ({weather:.0%}) at {scope}. Significant disruption risk."
            disruptions.append(CausalDisruption(
                disruption_type="severe_weather",
                scope_type=scope_type, scope_name=scope,
                severity=sev, severity_score=score,
                causal_reason=reason,
                duration_hours=24.0, capacity_reduction=0.70,
                delay_multiplier=2.0,
            ))
            violations.append(ConditionViolation(
                "weather_severity", scope, "WEATHER_SEVERE",
                weather, WEATHER_SEVERE, sev, "Severe weather — significant disruption"
            ))
            event_log.append({"stage": "condition_changed", "entity": scope,
                               "condition": "weather_severity", "value": weather, "severity": sev,
                               "consequence": "severe_weather disruption"})


# ── Main Entry Point ──────────────────────────────────────────────────────────

def run_causal_engine(
    conditions: List[Dict[str, Any]],
    direct_disruptions: List[Dict[str, Any]],
) -> CausalEngineResult:
    """
    Process conditions and direct disruptions through the causal rule engine.

    Parameters
    ----------
    conditions:
        List of condition state dicts, each with keys matching ConditionState columns.
    direct_disruptions:
        List of direct disruption dicts from Manual Mode input.

    Returns
    -------
    CausalEngineResult with generated disruptions, violations, merged scenario, event log.
    """
    result = CausalEngineResult(
        input_conditions=conditions,
        input_direct_disruptions=direct_disruptions,
    )

    violations: List[ConditionViolation] = []
    generated: List[CausalDisruption] = []
    event_log: List[Dict[str, Any]] = []

    # ── Process conditions through causal rules ───────────────────────────────
    for cond in conditions:
        _apply_condition_rules(cond, violations, generated, event_log)

    # ── Process direct disruptions ────────────────────────────────────────────
    for dd in direct_disruptions:
        dtype = dd.get("disruption_type", "severe_weather")
        scope_name = dd.get("scope_name", dd.get("location", "Unknown"))
        severity = dd.get("severity", "medium")
        severity_score = {"low": 0.3, "medium": 0.6, "high": 0.9}.get(severity, 0.6)
        reason = dd.get("causal_reason") or f"Direct disruption: {dtype} at {scope_name} (manually entered)"
        dur = dd.get("duration_hours", 24.0)
        cap = dd.get("capacity_reduction", 1.0)
        conn_id = dd.get("connection_id")

        causal = CausalDisruption(
            disruption_type=dtype,
            scope_type=dd.get("scope_type", "node"),
            scope_name=scope_name,
            severity=severity,
            severity_score=severity_score,
            causal_source="manual",
            causal_reason=reason,
            duration_hours=float(dur),
            capacity_reduction=float(cap),
        )
        if conn_id:
            causal.interrupt_connections = [conn_id]
        generated.append(causal)

        event_log.append({
            "stage": "disruption_detected",
            "entity": scope_name,
            "disruption_type": dtype,
            "severity": severity,
            "source": "manual",
            "consequence": f"Direct disruption applied: {dtype}",
        })

    result.violations = violations
    result.generated_disruptions = generated
    result.event_log = event_log

    # ── Build merged simulation scenario ─────────────────────────────────────
    # If multiple disruptions exist, pick worst/dominant one for the
    # existing simulation engine (which expects a single disruption).
    # Multi-event support: we pass the worst disruption as the primary scenario,
    # but also expose all_disruptions for future compound handling.
    if generated:
        worst = max(generated, key=lambda d: d.severity_score)
        result.merged_scenario = {
            "disruption_type": worst.disruption_type,
            "location": worst.scope_name,
            "duration_hours": worst.duration_hours,
            "severity": worst.severity,
            "capacity_reduction": worst.capacity_reduction,
            "delay_multiplier": worst.delay_multiplier,
            "cost_multiplier": worst.cost_multiplier,
            "temperature_risk_multiplier": worst.temperature_risk_multiplier,
        }
        # Excluded nodes = scope_names of all node-level disruptions
        result.excluded_nodes = list({
            d.scope_name for d in generated if d.scope_type in ("node", "region")
        })
        # Interrupted connections
        result.interrupted_connection_ids = list({
            c for d in generated for c in d.interrupt_connections
        })

    # ── Build causal narrative ────────────────────────────────────────────────
    parts = []
    for v in violations:
        parts.append(
            f"{v.condition_name.replace('_', ' ').title()} at {v.scope_name}: "
            f"{v.value:.1f} (threshold: {v.threshold_value:.1f}) → {v.consequence}"
        )
    for dd in direct_disruptions:
        parts.append(
            f"Direct {dd.get('disruption_type', 'disruption')} at "
            f"{dd.get('scope_name', dd.get('location', 'unknown'))}"
        )
    result.causal_narrative = "; ".join(parts) if parts else "No conditions violated thresholds."

    logger.info(
        f"Causal engine: {len(conditions)} conditions, {len(direct_disruptions)} direct disruptions "
        f"→ {len(generated)} generated disruptions, {len(violations)} violations"
    )
    return result
