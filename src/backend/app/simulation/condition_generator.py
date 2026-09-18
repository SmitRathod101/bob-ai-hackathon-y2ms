"""
Autonomous Condition Generator — ChainMind AI Round 2 Auto Mode

Generates bounded, realistic condition changes for autonomous monitoring.
NOT random — uses controlled patterns around operational baselines.

Strategy:
- Each monitored location has a baseline condition set
- Conditions evolve step-by-step using bounded deltas
- Some scenarios escalate (e.g., a building monsoon)
- Conditions wrap around after they stabilize or escalate to max

The generator produces condition states that are fed into the existing
Causal Engine unchanged — so all threshold logic is reused.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Location Baselines ────────────────────────────────────────────────────────
# Realistic starting conditions per location.
# Values represent normal-day operational environment.

LOCATION_BASELINES: Dict[str, Dict[str, float]] = {
    "Mumbai": {
        "rainfall_mm": 15.0,
        "humidity_pct": 78.0,
        "temperature_c": 32.0,
        "traffic_level": 0.55,
        "road_condition": 0.72,
        "port_congestion": 0.45,
        "weather_severity": 0.25,
    },
    "Chennai": {
        "rainfall_mm": 10.0,
        "humidity_pct": 80.0,
        "temperature_c": 34.0,
        "traffic_level": 0.50,
        "road_condition": 0.70,
        "port_congestion": 0.40,
        "weather_severity": 0.20,
    },
    "Delhi": {
        "rainfall_mm": 5.0,
        "humidity_pct": 55.0,
        "temperature_c": 38.0,
        "traffic_level": 0.65,
        "road_condition": 0.68,
        "port_congestion": 0.30,
        "weather_severity": 0.15,
    },
    "Kolkata": {
        "rainfall_mm": 20.0,
        "humidity_pct": 85.0,
        "temperature_c": 31.0,
        "traffic_level": 0.55,
        "road_condition": 0.65,
        "port_congestion": 0.50,
        "weather_severity": 0.30,
    },
    "Bengaluru": {
        "rainfall_mm": 12.0,
        "humidity_pct": 72.0,
        "temperature_c": 29.0,
        "traffic_level": 0.62,
        "road_condition": 0.75,
        "port_congestion": 0.25,
        "weather_severity": 0.15,
    },
    "Ahmedabad": {
        "rainfall_mm": 5.0,
        "humidity_pct": 48.0,
        "temperature_c": 40.0,
        "traffic_level": 0.48,
        "road_condition": 0.74,
        "port_congestion": 0.30,
        "weather_severity": 0.18,
    },
    "Hyderabad": {
        "rainfall_mm": 8.0,
        "humidity_pct": 65.0,
        "temperature_c": 36.0,
        "traffic_level": 0.52,
        "road_condition": 0.72,
        "port_congestion": 0.28,
        "weather_severity": 0.20,
    },
}

# Default baseline for unknown locations
DEFAULT_BASELINE: Dict[str, float] = {
    "rainfall_mm": 10.0,
    "humidity_pct": 65.0,
    "temperature_c": 33.0,
    "traffic_level": 0.50,
    "road_condition": 0.70,
    "port_congestion": 0.35,
    "weather_severity": 0.20,
}

# ── Condition Bounds ──────────────────────────────────────────────────────────
# Hard min/max for each condition variable

CONDITION_BOUNDS: Dict[str, tuple[float, float]] = {
    "rainfall_mm":     (0.0, 200.0),
    "humidity_pct":    (20.0, 100.0),
    "temperature_c":   (-5.0, 55.0),
    "traffic_level":   (0.0, 1.0),
    "road_condition":  (0.0, 1.0),
    "port_congestion": (0.0, 1.0),
    "weather_severity":(0.0, 1.0),
}

# ── Scenario Patterns ─────────────────────────────────────────────────────────
# Named escalation patterns for controlled condition evolution

SCENARIOS = {
    "monsoon_buildup": {
        "description": "Gradually intensifying monsoon rainfall",
        "steps": [
            {"rainfall_mm": +15.0, "humidity_pct": +5.0, "weather_severity": +0.10},
            {"rainfall_mm": +20.0, "humidity_pct": +5.0, "road_condition": -0.10, "weather_severity": +0.12},
            {"rainfall_mm": +25.0, "humidity_pct": +3.0, "road_condition": -0.12, "weather_severity": +0.15},
            {"rainfall_mm": +20.0, "road_condition": -0.08, "port_congestion": +0.10},
            {"rainfall_mm": -10.0, "weather_severity": -0.05, "road_condition": -0.05},  # tapering
        ],
    },
    "heatwave": {
        "description": "Progressive temperature increase with traffic buildup",
        "steps": [
            {"temperature_c": +3.0, "traffic_level": +0.06},
            {"temperature_c": +3.0, "traffic_level": +0.07, "humidity_pct": +5.0},
            {"temperature_c": +2.0, "traffic_level": +0.05, "road_condition": -0.05},
            {"temperature_c": -2.0, "traffic_level": -0.03},  # cooling
            {"temperature_c": -3.0, "traffic_level": -0.05},
        ],
    },
    "port_congestion_spike": {
        "description": "Gradual port congestion build-up",
        "steps": [
            {"port_congestion": +0.12, "traffic_level": +0.05},
            {"port_congestion": +0.15, "traffic_level": +0.08},
            {"port_congestion": +0.10, "traffic_level": +0.05},
            {"port_congestion": -0.08, "traffic_level": -0.04},
            {"port_congestion": -0.10, "traffic_level": -0.05},
        ],
    },
    "road_degradation": {
        "description": "Progressive road condition deterioration",
        "steps": [
            {"road_condition": -0.10, "traffic_level": +0.05},
            {"road_condition": -0.12, "traffic_level": +0.08, "weather_severity": +0.08},
            {"road_condition": -0.10, "rainfall_mm": +10.0, "weather_severity": +0.10},
            {"road_condition": +0.05, "rainfall_mm": -5.0},  # partial recovery
            {"road_condition": +0.08},
        ],
    },
    "normal_fluctuation": {
        "description": "Normal day-to-day variation without crisis threshold breach",
        "steps": [
            {"rainfall_mm": +5.0, "traffic_level": +0.04},
            {"traffic_level": +0.03, "temperature_c": +1.0},
            {"rainfall_mm": -3.0, "traffic_level": -0.02},
            {"temperature_c": -1.0, "traffic_level": +0.02},
            {"rainfall_mm": +2.0, "port_congestion": +0.05},
        ],
    },
}


@dataclass
class ConditionSnapshot:
    """Current condition state for a location."""
    location: str
    scope_type: str = "node"
    rainfall_mm: float = 0.0
    humidity_pct: float = 65.0
    temperature_c: float = 33.0
    traffic_level: float = 0.50
    road_condition: float = 0.70
    port_congestion: float = 0.35
    weather_severity: float = 0.20
    scenario_name: str = "normal_fluctuation"
    step_index: int = 0  # which step in the scenario we're on

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scope_type": self.scope_type,
            "scope_name": self.location,
            "rainfall_mm": round(self.rainfall_mm, 2),
            "humidity_pct": round(self.humidity_pct, 2),
            "temperature_c": round(self.temperature_c, 2),
            "traffic_level": round(self.traffic_level, 4),
            "road_condition": round(self.road_condition, 4),
            "port_congestion": round(self.port_congestion, 4),
            "weather_severity": round(self.weather_severity, 4),
        }


class ConditionGenerator:
    """
    Generates controlled, bounded condition evolution for Auto Mode.
    State is held in memory (not persisted between server restarts).
    The DB snapshot in AutoModeRun.current_conditions_json is the recovery source.
    """

    def __init__(self, location: str, initial_scenario: str = "normal_fluctuation"):
        baseline = LOCATION_BASELINES.get(location, DEFAULT_BASELINE)
        self.snapshot = ConditionSnapshot(
            location=location,
            rainfall_mm=baseline["rainfall_mm"],
            humidity_pct=baseline["humidity_pct"],
            temperature_c=baseline["temperature_c"],
            traffic_level=baseline["traffic_level"],
            road_condition=baseline["road_condition"],
            port_congestion=baseline["port_congestion"],
            weather_severity=baseline["weather_severity"],
            scenario_name=initial_scenario,
            step_index=0,
        )
        logger.info(f"ConditionGenerator initialized for {location} with scenario={initial_scenario}")

    def restore_from_dict(self, d: Dict[str, Any]) -> None:
        """Restore snapshot from a dict (e.g. from DB)."""
        self.snapshot.rainfall_mm = d.get("rainfall_mm", self.snapshot.rainfall_mm)
        self.snapshot.humidity_pct = d.get("humidity_pct", self.snapshot.humidity_pct)
        self.snapshot.temperature_c = d.get("temperature_c", self.snapshot.temperature_c)
        self.snapshot.traffic_level = d.get("traffic_level", self.snapshot.traffic_level)
        self.snapshot.road_condition = d.get("road_condition", self.snapshot.road_condition)
        self.snapshot.port_congestion = d.get("port_congestion", self.snapshot.port_congestion)
        self.snapshot.weather_severity = d.get("weather_severity", self.snapshot.weather_severity)
        self.snapshot.scenario_name = d.get("scenario_name", self.snapshot.scenario_name)
        self.snapshot.step_index = d.get("step_index", self.snapshot.step_index)

    def set_scenario(self, scenario_name: str) -> None:
        """Switch to a named scenario and reset its step counter."""
        if scenario_name in SCENARIOS:
            self.snapshot.scenario_name = scenario_name
            self.snapshot.step_index = 0
            logger.info(f"Scenario set to '{scenario_name}' for {self.snapshot.location}")

    def advance(self) -> Dict[str, Any]:
        """
        Advance one step and return the new conditions dict.
        After the last step of a scenario, cycle back to step 0.
        """
        scenario = SCENARIOS.get(self.snapshot.scenario_name, SCENARIOS["normal_fluctuation"])
        steps = scenario["steps"]
        step_idx = self.snapshot.step_index % len(steps)
        deltas = steps[step_idx]

        for key, delta in deltas.items():
            current = getattr(self.snapshot, key, None)
            if current is None:
                continue
            lo, hi = CONDITION_BOUNDS.get(key, (0.0, 1.0))
            new_val = max(lo, min(hi, current + delta))
            setattr(self.snapshot, key, new_val)

        self.snapshot.step_index = (self.snapshot.step_index + 1) % len(steps)

        logger.debug(
            f"Auto conditions step {step_idx}/{len(steps)-1} for "
            f"{self.snapshot.location} [{self.snapshot.scenario_name}]: "
            f"rain={self.snapshot.rainfall_mm:.1f} road={self.snapshot.road_condition:.2f} "
            f"traffic={self.snapshot.traffic_level:.2f}"
        )
        return self.snapshot.to_dict()

    def current(self) -> Dict[str, Any]:
        """Return the current conditions without advancing."""
        return self.snapshot.to_dict()

    def snapshot_for_db(self) -> Dict[str, Any]:
        """Full snapshot dict including scenario tracking, for DB persistence."""
        d = self.snapshot.to_dict()
        d["scenario_name"] = self.snapshot.scenario_name
        d["step_index"] = self.snapshot.step_index
        return d
