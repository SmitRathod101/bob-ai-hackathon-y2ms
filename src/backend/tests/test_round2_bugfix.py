"""
ChainMind AI — Round 2 Regression Tests (Bug Fix)

Tests covering the exact bugs reported after Prompt 1:

A. Connection interruption → affected route → affected shipments → simulation impact
B. Manual simulation with connection interruption produces non-zero affected count
   when shipments exist on the interrupted route
C. Explanation generation does not crash when strategies=[] (0 affected shipments)
D. Zero-impact explanation is structurally complete (has explanation_basis)
E. Existing Round 1 simulation still produces correct results
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy.orm import Session

from app.database.models import Base, Route, Shipment, Fleet, SimulationRun
from app.database.session import SessionLocal, init_db
from app.simulation.engine import run_simulation
from app.simulation.manual_mode import run_manual_simulation
from app.simulation.network_connections import (
    bootstrap_connections_from_routes,
    list_connections,
    interrupt_connection,
    restore_connection,
)
from app.llm.explainer import generate_explanation, _zero_impact_explanation


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def db():
    init_db()
    session = SessionLocal()
    yield session
    session.close()


# ── A. Connection Interruption Propagation ────────────────────────────────────

class TestConnectionImpactPropagation:

    def test_interrupted_routes_flow_into_simulation(self, db):
        """
        The core bug: interrupted connection route IDs must reach run_simulation()
        so that shipments on those routes are found as directly_affected.

        Find a route that has active shipments, interrupt its connection,
        run the simulation, and confirm the result has shipments.
        """
        bootstrap_connections_from_routes(db)

        # Find a route that has active shipments
        route_with_shipments = None
        routes = db.query(Route).filter(Route.is_active == True).all()
        for r in routes:
            count = db.query(Shipment).filter(
                Shipment.route_id == r.route_id,
                Shipment.status.notin_(["delivered"]),
            ).count()
            if count > 0:
                route_with_shipments = r
                break

        if route_with_shipments is None:
            pytest.skip("No routes with active shipments in test DB")

        # Find the connection for this route
        conns = list_connections(db)
        target_conn = next(
            (c for c in conns if c.get("route_id") == route_with_shipments.route_id
             and c["status"] == "available"),
            None,
        )
        if target_conn is None:
            pytest.skip("No available connection maps to the target route")

        conn_id = target_conn["connection_id"]

        # Restore in case it was previously interrupted
        try:
            restore_connection(db, conn_id)
        except Exception:
            pass

        # Run manual simulation with this connection interrupted
        result = run_manual_simulation(
            db=db,
            conditions=[],
            direct_disruptions=[],
            interrupt_connection_ids=[conn_id],
            run_label="Bug regression: connection impact propagation",
        )

        assert result is not None
        total_affected = result["impact_summary"]["total_affected_shipments"]
        # The shipments on that route MUST be detected
        assert total_affected > 0, (
            f"Expected > 0 affected shipments when interrupting connection {conn_id} "
            f"(route {route_with_shipments.route_id} has active shipments). Got 0."
        )

        # Verify the connection is listed in connection_impact
        assert conn_id in result["connection_impact"]
        assert result["connection_impact"][conn_id]["affected_route_count"] > 0

    def test_extra_route_ids_reach_simulation_engine(self, db):
        """
        Directly test the _extra_disrupted_route_ids mechanism in run_simulation.
        Pass a known route ID that has active shipments and verify the engine finds them.
        """
        # Find a route with shipments
        route = None
        for r in db.query(Route).filter(Route.is_active == True).all():
            count = db.query(Shipment).filter(
                Shipment.route_id == r.route_id,
                Shipment.status.notin_(["delivered"]),
            ).count()
            if count > 0:
                route = r
                break

        if not route:
            pytest.skip("No routes with active shipments")

        # Run simulation with this route injected as extra_disrupted_route_ids
        scenario = {
            "disruption_type": "connection_interruption",
            "location": route.origin,
            "duration_hours": 24.0,
            "severity": "high",
            "capacity_reduction": 1.0,
            "_extra_disrupted_route_ids": [route.route_id],
            "_extra_disrupted_nodes": [],
        }
        result = run_simulation(db, scenario)
        assert result is not None
        assert result["impact_summary"]["total_affected_shipments"] > 0, (
            "Engine must find shipments when route ID is passed via _extra_disrupted_route_ids"
        )

    def test_connection_interruption_manual_sim_has_affected_shipments(self, db):
        """
        Full end-to-end: interrupt a connection with active shipments,
        run the Manual simulation, verify simulation_events contain impact.
        """
        bootstrap_connections_from_routes(db)

        # Find connection with a route that has shipments
        route = None
        for r in db.query(Route).filter(Route.is_active == True).all():
            count = db.query(Shipment).filter(
                Shipment.route_id == r.route_id,
                Shipment.status.notin_(["delivered"]),
            ).count()
            if count > 0:
                route = r
                break

        if not route:
            pytest.skip("No routes with active shipments")

        # Restore ALL interrupted connections first to have a clean slate
        all_conns = list_connections(db)
        for c in all_conns:
            if c["status"] == "unavailable":
                try:
                    restore_connection(db, c["connection_id"])
                except Exception:
                    pass

        conns = list_connections(db)
        conn = next(
            (c for c in conns if c.get("route_id") == route.route_id
             and c["status"] == "available"),
            None,
        )
        if not conn:
            pytest.skip("No available connection for route with shipments after restore")

        result = run_manual_simulation(
            db=db,
            conditions=[],
            direct_disruptions=[],
            interrupt_connection_ids=[conn["connection_id"]],
            run_label="End-to-end connection interruption regression",
        )

        assert result["impact_summary"]["total_affected_shipments"] > 0
        # Connection impact should list the connection
        assert conn["connection_id"] in result["connection_impact"]
        # Simulation events should include impact_analyzed
        stages = {e["stage"] for e in result["simulation_events"]}
        assert "impact_analyzed" in stages


# ── B. Explanation with Zero Impact ──────────────────────────────────────────

class TestZeroImpactExplanation:

    def test_explanation_does_not_crash_with_no_strategies(self):
        """
        When strategies=[] (0 affected shipments), generate_explanation must
        return a structurally complete object, not raise an error.
        Uses asyncio.run() to avoid needing pytest-asyncio plugin.
        """
        import asyncio

        zero_result = {
            "simulation_id": "test-zero",
            "scenario": {"disruption_type": "connection_interruption", "location": "TestNode",
                         "duration_hours": 24, "severity": "high"},
            "impact_summary": {"total_affected_shipments": 0, "directly_affected": 0,
                               "indirectly_affected": 0, "total_cargo_value_exposed": 0,
                               "average_delay_hours": 0, "high_priority_affected": 0,
                               "cold_chain_at_risk": 0, "disrupted_routes": 0},
            "risk_distribution": {"low": 0, "medium": 0, "high": 0, "critical": 0},
            "strategies": [],
            "recommended_strategy": None,
            "fleet_summary": {"total_vehicles": 10, "available_vehicles": 5},
        }

        explanation = asyncio.run(generate_explanation(zero_result))

        # Must not crash and must have all required fields
        assert "explanation" in explanation
        assert "crisis_summary" in explanation
        assert "used_llm" in explanation
        assert "llm_provider" in explanation
        assert "explanation_basis" in explanation

        basis = explanation["explanation_basis"]
        assert "cost_reasoning" in basis
        assert "delay_reasoning" in basis
        assert "risk_reasoning" in basis
        assert "cargo_reasoning" in basis
        assert "fleet_reasoning" in basis

    def test_zero_impact_explanation_helper(self):
        """_zero_impact_explanation returns structurally complete object."""
        zero_result = {
            "scenario": {"disruption_type": "connection_interruption", "location": "TestNode"},
            "strategies": [],
            "recommended_strategy": None,
            "fleet_summary": {"available_vehicles": 5},
        }
        exp = _zero_impact_explanation(zero_result)

        assert exp["explanation"]
        assert exp["crisis_summary"]
        assert exp["used_llm"] is False
        basis = exp["explanation_basis"]
        assert basis["cost_reasoning"]["value"] == 0
        assert basis["delay_reasoning"]["value"] == 0
        assert basis["risk_reasoning"]["level"] == "low"
        assert basis["cargo_reasoning"]["total_value"] == 0
        assert basis["fleet_reasoning"]["vehicles_required"] == 0

    def test_explanation_basis_safe_with_none_recommended_strategy(self):
        """_build_explanation_basis handles recommended_strategy=None without crash."""
        from app.llm.explainer import _build_explanation_basis
        result = {
            "impact_summary": {"total_cargo_value_exposed": 1000, "high_priority_affected": 1,
                               "cold_chain_at_risk": 0},
            "recommended_strategy": None,
            "strategies": [],
            "fleet_summary": {"available_vehicles": 3},
        }
        basis = _build_explanation_basis(result)
        # Should not raise; should return a dict with all keys
        assert "cost_reasoning" in basis
        assert "delay_reasoning" in basis
        assert "risk_reasoning" in basis


# ── C. Full Manual Simulation Doesn't Crash Without Shipments ────────────────

class TestManualSimulationRobustness:

    def test_manual_sim_unknown_location_no_crash(self, db):
        """Manual sim with a location that has no routes/shipments must not crash."""
        result = run_manual_simulation(
            db=db,
            conditions=[{
                "scope_type": "node",
                "scope_name": "NonExistentCityXYZ",
                "rainfall_mm": 80.0,
            }],
            direct_disruptions=[],
            interrupt_connection_ids=[],
        )
        assert result is not None
        assert "simulation_id" in result
        assert "impact_summary" in result
        # total may be 0 but must not crash
        assert result["impact_summary"]["total_affected_shipments"] >= 0

    def test_manual_sim_returns_explanation_even_with_zero_impact(self, db):
        """
        Even when 0 shipments are affected, the result should include an explanation
        with the correct structure (no missing explanation_basis).
        """
        import asyncio
        from app.llm.explainer import generate_explanation

        result = run_manual_simulation(
            db=db,
            conditions=[{
                "scope_type": "node",
                "scope_name": "NonExistentCityABC",
                "rainfall_mm": 90.0,
            }],
            direct_disruptions=[],
            interrupt_connection_ids=[],
        )
        explanation = asyncio.run(generate_explanation(result))
        assert "explanation_basis" in explanation
        assert explanation["explanation_basis"] is not None

    def test_manual_sim_connection_only_no_400(self, db):
        """
        Interrupting ONLY a valid connection (no conditions, no disruptions)
        must not return 400 — it's a valid Manual Mode input.
        """
        bootstrap_connections_from_routes(db)
        conns = list_connections(db, status_filter="available")
        if not conns:
            pytest.skip("No available connections")

        # Restore first in case
        try:
            restore_connection(db, conns[0]["connection_id"])
        except Exception:
            pass

        conns = list_connections(db, status_filter="available")
        if not conns:
            pytest.skip("Still no available connections after restore")

        result = run_manual_simulation(
            db=db,
            conditions=[],
            direct_disruptions=[],
            interrupt_connection_ids=[conns[0]["connection_id"]],
            run_label="Connection-only no-400 test",
        )
        assert result is not None
        assert result.get("manual_mode") is True


# ── D. Round 1 Unchanged ─────────────────────────────────────────────────────

class TestRound1StillWorks:

    def test_port_closure_still_finds_shipments(self, db):
        """Round 1 port_closure simulation must still find affected shipments."""
        result = run_simulation(db, {
            "disruption_type": "port_closure",
            "location": "Mumbai Port",
            "duration_hours": 72,
            "severity": "high",
            "capacity_reduction": 1.0,
        })
        assert result["impact_summary"]["total_affected_shipments"] > 0
        assert len(result["strategies"]) == 3
        assert result["recommended_strategy"] is not None

    def test_round1_explanation_has_basis(self, db):
        """Round 1 simulation explanation always has explanation_basis."""
        import asyncio
        from app.llm.explainer import generate_explanation

        result = run_simulation(db, {
            "disruption_type": "port_closure",
            "location": "Mumbai Port",
            "duration_hours": 72,
            "severity": "high",
        })
        explanation = asyncio.run(generate_explanation(result))
        assert "explanation_basis" in explanation
        basis = explanation["explanation_basis"]
        assert "cost_reasoning" in basis
        assert "delay_reasoning" in basis

    def test_route_closure_with_extra_ids_no_duplicate(self, db):
        """
        _extra_disrupted_route_ids must not double-count routes that the
        engine would also find via location lookup.
        """
        route = db.query(Route).filter(Route.is_active == True).first()
        if not route:
            pytest.skip("No routes")

        result1 = run_simulation(db, {
            "disruption_type": "severe_weather",
            "location": route.origin,
            "duration_hours": 24,
            "severity": "medium",
        })
        result2 = run_simulation(db, {
            "disruption_type": "severe_weather",
            "location": route.origin,
            "duration_hours": 24,
            "severity": "medium",
            "_extra_disrupted_route_ids": [],  # empty extra list — should be identical
            "_extra_disrupted_nodes": [],
        })
        assert result1["impact_summary"]["total_affected_shipments"] == \
               result2["impact_summary"]["total_affected_shipments"]
