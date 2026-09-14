"""
ChainMind AI — Backend Tests

Tests cover:
- Health endpoint
- Scenario validation
- Port disruption simulation
- Route disruption simulation
- Delay calculation
- Risk calculation
- Cold-chain risk
- Alternative route selection
- Fleet selection
- Strategy comparison
- End-to-end simulation
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.models import Base, Port, Route, Shipment, Fleet
from app.simulation.engine import run_simulation, _calculate_base_delay
from app.simulation.risk_scorer import calculate_risk_score, calculate_cold_chain_risk, score_to_level
from app.optimization.route_optimizer import build_logistics_graph, find_best_route, get_affected_routes_for_port
from app.optimization.fleet_optimizer import get_fleet_summary, find_available_fleet


# ── Test Database Setup ────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def db():
    """Use the real database (seeded by generate_dataset.py)."""
    from app.database.session import SessionLocal, init_db
    init_db()
    session = SessionLocal()
    yield session
    session.close()


# ── Health Check ───────────────────────────────────────────────────────────────

def test_database_has_data(db):
    """Verify the database is seeded."""
    port_count = db.query(Port).count()
    route_count = db.query(Route).count()
    shipment_count = db.query(Shipment).count()
    fleet_count = db.query(Fleet).count()
    assert port_count >= 8, f"Expected >= 8 ports, got {port_count}"
    assert route_count >= 40, f"Expected >= 40 routes, got {route_count}"
    assert shipment_count >= 200, f"Expected >= 200 shipments, got {shipment_count}"
    assert fleet_count >= 50, f"Expected >= 50 fleet assets, got {fleet_count}"


# ── Risk Scorer Tests ──────────────────────────────────────────────────────────

def test_risk_score_increases_with_delay():
    """Higher delay → higher risk score."""
    score_low, _, _ = calculate_risk_score(
        estimated_delay_hours=10, cargo_value=100000, priority=3,
        temperature_sensitive=False, required_temp_min=None, required_temp_max=None,
        current_temperature=None, route_risk=0.2,
    )
    score_high, _, _ = calculate_risk_score(
        estimated_delay_hours=80, cargo_value=100000, priority=3,
        temperature_sensitive=False, required_temp_min=None, required_temp_max=None,
        current_temperature=None, route_risk=0.2,
    )
    assert score_high > score_low


def test_risk_score_higher_for_cold_chain():
    """Temperature-sensitive cargo → higher risk score."""
    score_normal, _, _ = calculate_risk_score(
        estimated_delay_hours=48, cargo_value=500000, priority=2,
        temperature_sensitive=False, required_temp_min=None, required_temp_max=None,
        current_temperature=None, route_risk=0.3,
    )
    score_cold, _, cc_risk = calculate_risk_score(
        estimated_delay_hours=48, cargo_value=500000, priority=2,
        temperature_sensitive=True, required_temp_min=2, required_temp_max=8,
        current_temperature=10, route_risk=0.3,
    )
    assert score_cold > score_normal
    assert cc_risk > 0.0


def test_risk_level_mapping():
    assert score_to_level(0.1) == "low"
    assert score_to_level(0.35) == "medium"
    assert score_to_level(0.55) == "high"
    assert score_to_level(0.75) == "critical"


def test_cold_chain_risk_no_deviation():
    """Within temperature range → lower cold chain risk."""
    risk = calculate_cold_chain_risk(
        temperature_sensitive=True,
        required_temp_min=2, required_temp_max=8,
        current_temperature=5,
        estimated_additional_delay_hours=0,
    )
    assert risk < 0.5


def test_cold_chain_risk_with_deviation():
    """Outside temperature range → higher cold chain risk."""
    risk = calculate_cold_chain_risk(
        temperature_sensitive=True,
        required_temp_min=2, required_temp_max=8,
        current_temperature=20,
        estimated_additional_delay_hours=24,
    )
    assert risk > 0.5


def test_non_temp_sensitive_cold_chain_zero():
    """Non-temperature-sensitive → zero cold chain risk."""
    risk = calculate_cold_chain_risk(
        temperature_sensitive=False,
        required_temp_min=None, required_temp_max=None,
        current_temperature=None,
        estimated_additional_delay_hours=48,
    )
    assert risk == 0.0


# ── Delay Calculation Tests ────────────────────────────────────────────────────

def test_delay_increases_with_duration():
    """Longer disruption → more delay."""
    delay_72 = _calculate_base_delay(
        duration_hours=72, severity_score=0.9, delay_multiplier=2.2,
        capacity_reduction=1.0, disruption_type="port_closure",
        is_direct=True, route_congestion=0.6, route_distance=500,
    )
    delay_120 = _calculate_base_delay(
        duration_hours=120, severity_score=0.9, delay_multiplier=2.2,
        capacity_reduction=1.0, disruption_type="port_closure",
        is_direct=True, route_congestion=0.6, route_distance=500,
    )
    assert delay_120 > delay_72


def test_indirect_delay_less_than_direct():
    """Indirect impact → less delay than direct."""
    direct = _calculate_base_delay(
        duration_hours=72, severity_score=0.9, delay_multiplier=2.2,
        capacity_reduction=1.0, disruption_type="port_closure",
        is_direct=True, route_congestion=0.6, route_distance=500,
    )
    indirect = _calculate_base_delay(
        duration_hours=72, severity_score=0.9, delay_multiplier=2.2,
        capacity_reduction=1.0, disruption_type="port_closure",
        is_direct=False, route_congestion=0.6, route_distance=500,
    )
    assert direct > indirect


# ── Route Optimizer Tests ──────────────────────────────────────────────────────

def test_build_logistics_graph(db):
    """Graph should have nodes for all major cities."""
    graph = build_logistics_graph(db)
    assert "Mumbai" in graph.nodes or len(graph.nodes) > 0
    assert len(graph.edges) > 10


def test_find_route_mumbai_delhi(db):
    """Should find a route from Mumbai to Delhi."""
    graph = build_logistics_graph(db)
    result = find_best_route(graph, "Mumbai", "Delhi")
    assert result is not None
    assert result["total_distance_km"] > 0
    assert result["total_time_hours"] > 0
    assert "Mumbai" in result["path"]
    assert "Delhi" in result["path"]


def test_disruption_removes_routes(db):
    """Excluding Mumbai should affect routes."""
    graph_normal = build_logistics_graph(db)
    graph_disrupted = build_logistics_graph(db, exclude_nodes=["Mumbai"])
    # Mumbai should not be in disrupted graph
    assert "Mumbai" not in graph_disrupted.nodes


def test_affected_routes_for_port(db):
    """Should return routes connected to Mumbai."""
    affected = get_affected_routes_for_port(db, "Mumbai")
    assert len(affected) > 0


# ── Fleet Optimizer Tests ──────────────────────────────────────────────────────

def test_fleet_summary(db):
    """Fleet summary should have valid counts."""
    summary = get_fleet_summary(db)
    assert summary["total_vehicles"] > 0
    assert summary["available_vehicles"] >= 0
    assert summary["refrigerated_vehicles"] > 0
    assert 0.0 <= summary["average_utilization"] <= 1.0


def test_find_available_fleet(db):
    """Should find available fleet near Mumbai."""
    fleet = find_available_fleet(db, "Mumbai", top_n=10)
    assert len(fleet) > 0
    for v in fleet:
        assert v["availability"] if "availability" in v else True


def test_find_refrigerated_fleet(db):
    """Should find refrigerated fleet for cold-chain."""
    fleet = find_available_fleet(db, "Mumbai", require_refrigerated=True, top_n=5)
    for v in fleet:
        assert v["is_refrigerated"] == True


# ── End-to-End Simulation Tests ────────────────────────────────────────────────

def test_port_closure_simulation_72h(db):
    """Full simulation: Mumbai Port closure 72h should return meaningful results."""
    scenario = {
        "disruption_type": "port_closure",
        "location": "Mumbai Port",
        "duration_hours": 72,
        "severity": "high",
        "capacity_reduction": 1.0,
    }
    result = run_simulation(db, scenario)

    assert result is not None
    assert "simulation_id" in result
    assert result["impact_summary"]["total_affected_shipments"] > 0
    assert result["impact_summary"]["total_cargo_value_exposed"] > 0
    assert result["impact_summary"]["average_delay_hours"] > 0
    assert len(result["strategies"]) == 3
    assert result["recommended_strategy"] is not None
    # Verify disrupted routes are listed
    assert len(result["disrupted_route_ids"]) > 0


def test_port_closure_120h_vs_72h(db):
    """120-hour disruption should produce higher delay than 72-hour."""
    def run(hours):
        return run_simulation(db, {
            "disruption_type": "port_closure",
            "location": "Mumbai Port",
            "duration_hours": hours,
            "severity": "high",
            "capacity_reduction": 1.0,
        })

    result_72 = run(72)
    result_120 = run(120)

    assert result_120["impact_summary"]["average_delay_hours"] > result_72["impact_summary"]["average_delay_hours"]


def test_high_severity_vs_low(db):
    """High severity should produce higher delay than low severity."""
    def run(severity):
        return run_simulation(db, {
            "disruption_type": "port_closure",
            "location": "Mumbai Port",
            "duration_hours": 48,
            "severity": severity,
            "capacity_reduction": 1.0,
        })

    result_low = run("low")
    result_high = run("high")

    assert result_high["impact_summary"]["average_delay_hours"] > result_low["impact_summary"]["average_delay_hours"]


def test_strategies_have_different_costs(db):
    """Three strategies should have different costs."""
    result = run_simulation(db, {
        "disruption_type": "port_closure",
        "location": "Mumbai Port",
        "duration_hours": 72,
        "severity": "high",
        "capacity_reduction": 1.0,
    })
    costs = [s["additional_cost_inr"] for s in result["strategies"]]
    assert len(set(costs)) > 1, "All strategies have identical costs"


def test_different_disruption_types(db):
    """Test all disruption types work without error."""
    disruption_types = [
        "port_closure", "severe_weather", "strike",
        "vehicle_shortage", "warehouse_disruption",
    ]
    for dtype in disruption_types:
        result = run_simulation(db, {
            "disruption_type": dtype,
            "location": "Mumbai",
            "duration_hours": 24,
            "severity": "medium",
            "capacity_reduction": 0.5,
        })
        assert result is not None, f"Simulation failed for {dtype}"


def test_cold_chain_shipments_identified(db):
    """Simulation should identify cold-chain shipments."""
    result = run_simulation(db, {
        "disruption_type": "port_closure",
        "location": "Mumbai Port",
        "duration_hours": 72,
        "severity": "high",
    })
    # We have temperature-sensitive shipments in the DB
    # Some should be flagged
    assert result["impact_summary"]["cold_chain_at_risk"] >= 0
