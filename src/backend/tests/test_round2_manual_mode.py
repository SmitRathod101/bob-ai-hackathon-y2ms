"""
ChainMind AI — Round 2 Tests

Tests cover:
1. Manual condition change via causal engine
2. Condition → causal disruption rule mapping
3. Direct disruption injection
4. Connection interruption
5. Affected route detection from connection interruption
6. Affected shipment/fleet propagation
7. Existing delay/risk pipeline compatibility
8. Multiple events/conditions
9. Event persistence/history foundation
10. Rainfall → landslide/flood causal chain
11. Connection interruption → route/shipment impact
12. Existing Round 1 integration test compatibility
"""

import sys
import os
import json
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.models import (
    Base, Port, Route, Shipment, Fleet, SimulationRun, SimulationEvent,
    NetworkConnection, ConditionState, DirectDisruption
)
from app.simulation.causal_engine import (
    run_causal_engine, CausalEngineResult,
    RAIN_HIGH_MM, RAIN_EXTREME_MM, TEMP_HOT_C, TRAFFIC_HIGH,
    ROAD_POOR, PORT_CONGESTION_HIGH, WEATHER_SEVERE,
)
from app.simulation.network_connections import (
    bootstrap_connections_from_routes,
    list_connections,
    get_connection,
    interrupt_connection,
    restore_connection,
    get_routes_dependent_on_connection,
    build_graph_excluding_interrupted,
)
from app.simulation.manual_mode import (
    run_manual_simulation,
    get_manual_run_history,
    get_run_events,
)
from app.simulation.engine import run_simulation
from app.simulation.risk_scorer import calculate_risk_score, score_to_level


# ── Test Database Setup ────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def db():
    """Use the real database (seeded by generate_dataset.py)."""
    from app.database.session import SessionLocal, init_db
    init_db()
    session = SessionLocal()
    yield session
    session.close()


# ── 1. Causal Engine: Condition Change → Disruption ───────────────────────────

class TestCausalEngine:

    def test_no_conditions_no_disruptions(self):
        """Empty inputs → no violations, no generated disruptions."""
        result = run_causal_engine([], [])
        assert isinstance(result, CausalEngineResult)
        assert len(result.violations) == 0
        assert len(result.generated_disruptions) == 0
        assert len(result.event_log) == 0

    def test_low_rainfall_no_violation(self):
        """Rainfall below threshold → no violation generated."""
        result = run_causal_engine([{
            "scope_type": "node", "scope_name": "Mumbai",
            "rainfall_mm": 10.0,
        }], [])
        assert len(result.violations) == 0
        assert len(result.generated_disruptions) == 0

    def test_high_rainfall_generates_disruption(self):
        """Rainfall above RAIN_HIGH_MM → disruption generated."""
        result = run_causal_engine([{
            "scope_type": "node", "scope_name": "Mumbai",
            "rainfall_mm": RAIN_HIGH_MM + 10,
        }], [])
        assert len(result.generated_disruptions) >= 1
        types = [d.disruption_type for d in result.generated_disruptions]
        # Should be route_closure or severe_weather
        assert any(t in ("route_closure", "severe_weather") for t in types)

    def test_extreme_rainfall_generates_high_severity(self):
        """Extreme rainfall → high-severity disruption."""
        result = run_causal_engine([{
            "scope_type": "node", "scope_name": "Chennai",
            "rainfall_mm": RAIN_EXTREME_MM + 20,
        }], [])
        high_sev = [d for d in result.generated_disruptions if d.severity == "high"]
        assert len(high_sev) >= 1

    def test_extreme_rainfall_causal_chain(self):
        """Extreme rainfall → violation + disruption with causal reason."""
        result = run_causal_engine([{
            "scope_type": "node", "scope_name": "Mumbai",
            "rainfall_mm": 120.0,
        }], [])
        assert len(result.violations) > 0
        assert len(result.generated_disruptions) > 0
        # Causal reason should mention rainfall
        disruption = result.generated_disruptions[0]
        assert "rainfall" in disruption.causal_reason.lower() or "rain" in disruption.causal_reason.lower()
        # Event log should have entries
        assert len(result.event_log) > 0

    def test_high_temperature_cold_chain_risk(self):
        """High temperature → cold-chain multiplier elevated."""
        result = run_causal_engine([{
            "scope_type": "node", "scope_name": "Delhi",
            "temperature_c": TEMP_HOT_C + 5,
        }], [])
        assert len(result.generated_disruptions) >= 1
        multipliers = [d.temperature_risk_multiplier for d in result.generated_disruptions]
        assert any(m > 1.0 for m in multipliers)

    def test_high_traffic_generates_delay_disruption(self):
        """Traffic above TRAFFIC_HIGH → demand_spike or delay disruption."""
        result = run_causal_engine([{
            "scope_type": "node", "scope_name": "Delhi",
            "traffic_level": TRAFFIC_HIGH + 0.05,
        }], [])
        assert len(result.generated_disruptions) >= 1

    def test_poor_road_condition_generates_disruption(self):
        """Road condition below ROAD_POOR → route disruption."""
        result = run_causal_engine([{
            "scope_type": "node", "scope_name": "Pune",
            "road_condition": ROAD_POOR - 0.1,
        }], [])
        assert len(result.generated_disruptions) >= 1
        types = [d.disruption_type for d in result.generated_disruptions]
        assert any("route" in t or "closure" in t for t in types)

    def test_high_port_congestion_generates_port_disruption(self):
        """Port congestion above threshold → port disruption."""
        result = run_causal_engine([{
            "scope_type": "node", "scope_name": "Mumbai",
            "port_congestion": PORT_CONGESTION_HIGH + 0.05,
        }], [])
        assert len(result.generated_disruptions) >= 1
        types = [d.disruption_type for d in result.generated_disruptions]
        assert any("port" in t for t in types)

    def test_severe_weather_generates_severe_disruption(self):
        """Weather severity above WEATHER_SEVERE → severe_weather disruption."""
        result = run_causal_engine([{
            "scope_type": "node", "scope_name": "Kolkata",
            "weather_severity": WEATHER_SEVERE + 0.05,
        }], [])
        assert len(result.generated_disruptions) >= 1
        types = [d.disruption_type for d in result.generated_disruptions]
        assert "severe_weather" in types

    def test_merged_scenario_has_required_fields(self):
        """Causal engine produces a valid merged_scenario for simulation."""
        result = run_causal_engine([{
            "scope_type": "node", "scope_name": "Mumbai",
            "rainfall_mm": 80.0,
        }], [])
        assert "disruption_type" in result.merged_scenario
        assert "location" in result.merged_scenario
        assert "duration_hours" in result.merged_scenario
        assert "severity" in result.merged_scenario

    def test_multiple_conditions_compound(self):
        """Multiple conditions → multiple disruptions generated."""
        result = run_causal_engine([
            {"scope_type": "node", "scope_name": "Mumbai", "rainfall_mm": 80.0},
            {"scope_type": "node", "scope_name": "Mumbai", "road_condition": 0.2},
            {"scope_type": "node", "scope_name": "Mumbai", "traffic_level": 0.85},
        ], [])
        # Should have at least 3 disruptions (one per violating condition)
        assert len(result.generated_disruptions) >= 3

    def test_direct_disruption_passthrough(self):
        """Direct disruption → included in generated_disruptions."""
        result = run_causal_engine([], [{
            "disruption_type": "landslide",
            "scope_type": "node",
            "scope_name": "Mumbai",
            "severity": "high",
            "duration_hours": 36.0,
            "capacity_reduction": 1.0,
        }])
        assert len(result.generated_disruptions) >= 1
        types = [d.disruption_type for d in result.generated_disruptions]
        assert "landslide" in types

    def test_worst_disruption_selected_for_scenario(self):
        """Merged scenario uses worst severity score disruption."""
        result = run_causal_engine([
            {"scope_type": "node", "scope_name": "Mumbai", "rainfall_mm": 120.0},  # high
            {"scope_type": "node", "scope_name": "Pune", "traffic_level": 0.72},   # medium
        ], [])
        # Merged scenario should reflect high severity
        assert result.merged_scenario.get("severity") in ("medium", "high")
        best_score = max(d.severity_score for d in result.generated_disruptions)
        assert best_score >= 0.6

    def test_causal_narrative_populated(self):
        """Causal narrative is non-empty when violations occur."""
        result = run_causal_engine([{
            "scope_type": "node", "scope_name": "Mumbai",
            "rainfall_mm": 80.0,
        }], [])
        assert result.causal_narrative
        assert len(result.causal_narrative) > 10


# ── 2. Direct Disruption ──────────────────────────────────────────────────────

class TestDirectDisruption:

    def test_direct_disruption_runs_simulation(self, db):
        """Direct disruption → simulation executes and returns results."""
        result = run_manual_simulation(
            db=db,
            conditions=[],
            direct_disruptions=[{
                "disruption_type": "port_closure",
                "scope_type": "node",
                "scope_name": "Mumbai",
                "severity": "high",
                "duration_hours": 48.0,
                "capacity_reduction": 1.0,
                "causal_reason": "Test direct disruption",
            }],
            interrupt_connection_ids=[],
            run_label="Test direct disruption",
        )
        assert result is not None
        assert "simulation_id" in result
        assert result.get("manual_mode") is True
        assert result["impact_summary"]["total_affected_shipments"] >= 0

    def test_direct_disruption_condition_state_persisted(self, db):
        """Conditions are persisted to condition_states table."""
        run_manual_simulation(
            db=db,
            conditions=[{
                "scope_type": "node",
                "scope_name": "Chennai",
                "rainfall_mm": 60.0,
                "temperature_c": 38.0,
            }],
            direct_disruptions=[],
            interrupt_connection_ids=[],
        )
        # Find the latest condition state for Chennai
        cs = db.query(ConditionState).filter(
            ConditionState.scope_name == "Chennai"
        ).order_by(ConditionState.created_at.desc()).first()
        assert cs is not None
        assert cs.rainfall_mm == 60.0
        assert cs.temperature_c == 38.0

    def test_simulation_run_marked_as_manual(self, db):
        """SimulationRun.mode is 'manual' for Manual Mode runs."""
        result = run_manual_simulation(
            db=db,
            conditions=[],
            direct_disruptions=[{
                "disruption_type": "flood",
                "scope_type": "node",
                "scope_name": "Kolkata",
                "severity": "medium",
                "duration_hours": 24.0,
                "capacity_reduction": 0.8,
            }],
            interrupt_connection_ids=[],
            run_label="Mode check",
        )
        sim_id = result["simulation_id"]
        run = db.query(SimulationRun).filter(SimulationRun.simulation_id == sim_id).first()
        assert run is not None
        assert run.mode == "manual"

    def test_multiple_direct_disruptions(self, db):
        """Multiple direct disruptions → worst drives the simulation."""
        result = run_manual_simulation(
            db=db,
            conditions=[],
            direct_disruptions=[
                {
                    "disruption_type": "road_blockage",
                    "scope_type": "node",
                    "scope_name": "Pune",
                    "severity": "low",
                    "duration_hours": 6.0,
                    "capacity_reduction": 0.3,
                },
                {
                    "disruption_type": "port_closure",
                    "scope_type": "node",
                    "scope_name": "Mumbai",
                    "severity": "high",
                    "duration_hours": 72.0,
                    "capacity_reduction": 1.0,
                },
            ],
            interrupt_connection_ids=[],
        )
        causal = result.get("causal_info", {})
        assert len(causal.get("generated_disruptions", [])) >= 2


# ── 3. Connection Interruption ────────────────────────────────────────────────

class TestConnectionInterruption:

    def test_bootstrap_connections_from_routes(self, db):
        """Bootstrapping populates network_connections from routes."""
        count = bootstrap_connections_from_routes(db)
        # Either creates new ones or returns 0 if already done
        total = db.query(NetworkConnection).count()
        assert total > 0

    def test_list_connections_returns_records(self, db):
        """List connections returns non-empty list."""
        bootstrap_connections_from_routes(db)
        conns = list_connections(db)
        assert len(conns) > 0
        for c in conns[:5]:
            assert "connection_id" in c
            assert "from_node" in c
            assert "to_node" in c
            assert "status" in c

    def test_get_connection_returns_record(self, db):
        """Get connection by ID returns expected fields."""
        bootstrap_connections_from_routes(db)
        conns = list_connections(db)
        assert len(conns) > 0
        first_id = conns[0]["connection_id"]
        conn = get_connection(db, first_id)
        assert conn is not None
        assert conn["connection_id"] == first_id

    def test_interrupt_connection_changes_status(self, db):
        """Interrupting a connection sets status to unavailable."""
        bootstrap_connections_from_routes(db)
        conns = list_connections(db, status_filter="available")
        assert len(conns) > 0
        target = conns[0]
        conn_id = target["connection_id"]

        conn_dict, route_ids, ship_ids = interrupt_connection(
            db, conn_id, reason="Test interruption"
        )
        assert conn_dict["status"] == "unavailable"
        assert conn_dict["disruption_reason"] == "Test interruption"
        assert isinstance(route_ids, list)
        assert isinstance(ship_ids, list)

    def test_interrupt_connection_creates_direct_disruption(self, db):
        """Interrupting a connection persists a DirectDisruption record."""
        bootstrap_connections_from_routes(db)
        conns = list_connections(db, status_filter="available")
        target = conns[0]
        conn_id = target["connection_id"]

        interrupt_connection(db, conn_id, reason="Disruption persistence test")

        dd = db.query(DirectDisruption).filter(
            DirectDisruption.connection_id == conn_id,
        ).first()
        assert dd is not None
        assert dd.disruption_type == "connection_interruption"
        assert dd.is_active is True

    def test_restore_connection_changes_status(self, db):
        """Restoring a connection sets status back to available."""
        bootstrap_connections_from_routes(db)
        conns = list_connections(db, status_filter="available")
        target = conns[-1]  # use a different one
        conn_id = target["connection_id"]

        interrupt_connection(db, conn_id, reason="Test for restore")
        conn_dict = restore_connection(db, conn_id)
        assert conn_dict["status"] == "available"

    def test_affected_routes_for_connection(self, db):
        """get_routes_dependent_on_connection returns route IDs."""
        bootstrap_connections_from_routes(db)
        conns = list_connections(db)
        # Find a connection that has a route_id
        conn_with_route = next((c for c in conns if c.get("route_id")), None)
        if conn_with_route:
            route_ids = get_routes_dependent_on_connection(db, conn_with_route["connection_id"])
            assert len(route_ids) > 0

    def test_graph_excludes_interrupted_connections(self, db):
        """Graph built after interruption excludes the interrupted route."""
        bootstrap_connections_from_routes(db)
        conns = list_connections(db, status_filter="available")
        # Get a connection that has a route_id
        conn_with_route = next((c for c in conns if c.get("route_id")), None)
        if conn_with_route is None:
            pytest.skip("No connections with route_id found")

        conn_id = conn_with_route["connection_id"]
        route_id = conn_with_route["route_id"]

        # Interrupt it
        interrupt_connection(db, conn_id, reason="Graph test")

        # Build graph — should exclude the interrupted route
        graph = build_graph_excluding_interrupted(db)
        # The route_id should not appear in the graph edges
        route_ids_in_graph = [data.get("route_id") for _, _, data in graph.edges(data=True)]
        assert route_id not in route_ids_in_graph

    def test_interrupt_unknown_connection_raises(self, db):
        """Interrupting a non-existent connection raises ValueError."""
        import pytest as pt
        with pt.raises(ValueError):
            interrupt_connection(db, "conn_does_not_exist", reason="Test")


# ── 4. End-to-End: Manual Mode Pipeline ──────────────────────────────────────

class TestManualModePipeline:

    def test_rainfall_causes_disruption_and_simulation(self, db):
        """
        High rainfall → causal engine → route closure disruption →
        simulation pipeline → affected shipments.
        """
        result = run_manual_simulation(
            db=db,
            conditions=[{
                "scope_type": "node",
                "scope_name": "Mumbai",
                "rainfall_mm": 80.0,
                "road_condition": 0.3,
            }],
            direct_disruptions=[],
            interrupt_connection_ids=[],
            run_label="Rainfall causal chain test",
        )

        assert result is not None
        assert result["manual_mode"] is True
        causal = result["causal_info"]
        assert len(causal["violations"]) > 0
        assert len(causal["generated_disruptions"]) > 0
        # Should have at least one condition_changed event
        events = result.get("simulation_events", [])
        stages = [e["stage"] for e in events]
        assert "condition_changed" in stages
        assert "disruption_detected" in stages

    def test_connection_interruption_in_simulation(self, db):
        """Connection interruption → simulation picks up affected routes."""
        bootstrap_connections_from_routes(db)
        conns = list_connections(db, status_filter="available")
        if not conns:
            pytest.skip("No available connections")

        # Restore any previously interrupted connections first
        for c in conns[:3]:
            if c["status"] == "unavailable":
                restore_connection(db, c["connection_id"])

        available = list_connections(db, status_filter="available")
        if not available:
            pytest.skip("No available connections after restore")

        target = available[0]["connection_id"]

        result = run_manual_simulation(
            db=db,
            conditions=[],
            direct_disruptions=[],
            interrupt_connection_ids=[target],
            run_label="Connection interruption test",
        )

        assert result is not None
        assert result["manual_mode"] is True
        conn_impact = result.get("connection_impact", {})
        assert target in conn_impact

    def test_simulation_events_persisted(self, db):
        """SimulationEvent records are persisted for Manual Mode runs."""
        result = run_manual_simulation(
            db=db,
            conditions=[{
                "scope_type": "node",
                "scope_name": "Delhi",
                "traffic_level": 0.85,
            }],
            direct_disruptions=[],
            interrupt_connection_ids=[],
        )
        sim_id = result["simulation_id"]
        events = get_run_events(db, sim_id)
        assert len(events) > 0
        # Should have at least: condition_changed, disruption_detected, impact_analyzed
        stages = {e["stage"] for e in events}
        assert "condition_changed" in stages
        assert "impact_analyzed" in stages

    def test_manual_history_contains_run(self, db):
        """Manual run history contains the run after execution."""
        result = run_manual_simulation(
            db=db,
            conditions=[{
                "scope_type": "node",
                "scope_name": "Pune",
                "weather_severity": 0.8,
            }],
            direct_disruptions=[],
            interrupt_connection_ids=[],
            run_label="History test run",
        )
        sim_id = result["simulation_id"]
        history = get_manual_run_history(db)
        sim_ids = [h["simulation_id"] for h in history]
        assert sim_id in sim_ids

    def test_manual_run_label_persisted(self, db):
        """run_label is persisted on the SimulationRun record."""
        label = f"Label test {uuid.uuid4().hex[:8]}"
        result = run_manual_simulation(
            db=db,
            conditions=[{
                "scope_type": "node",
                "scope_name": "Bengaluru",
                "rainfall_mm": 55.0,
            }],
            direct_disruptions=[],
            interrupt_connection_ids=[],
            run_label=label,
        )
        sim_id = result["simulation_id"]
        run = db.query(SimulationRun).filter(SimulationRun.simulation_id == sim_id).first()
        assert run is not None
        assert run.run_label == label

    def test_source_events_persisted(self, db):
        """source_events_json captures conditions and disruptions."""
        result = run_manual_simulation(
            db=db,
            conditions=[{
                "scope_type": "node",
                "scope_name": "Hyderabad",
                "rainfall_mm": 45.0,
            }],
            direct_disruptions=[{
                "disruption_type": "bridge_failure",
                "scope_type": "node",
                "scope_name": "Hyderabad",
                "severity": "high",
                "duration_hours": 24.0,
                "capacity_reduction": 1.0,
            }],
            interrupt_connection_ids=[],
        )
        sim_id = result["simulation_id"]
        run = db.query(SimulationRun).filter(SimulationRun.simulation_id == sim_id).first()
        assert run is not None
        assert run.source_events_json is not None
        source = json.loads(run.source_events_json)
        assert len(source["conditions"]) == 1
        assert len(source["direct_disruptions"]) == 1


# ── 5. Existing Pipeline Compatibility ────────────────────────────────────────

class TestPipelineCompatibility:

    def test_manual_mode_strategies_present(self, db):
        """Manual simulation returns recovery strategies."""
        result = run_manual_simulation(
            db=db,
            conditions=[],
            direct_disruptions=[{
                "disruption_type": "port_closure",
                "scope_type": "node",
                "scope_name": "Chennai",
                "severity": "high",
                "duration_hours": 48.0,
                "capacity_reduction": 1.0,
            }],
            interrupt_connection_ids=[],
        )
        # If shipments are affected, strategies should be present
        if result["impact_summary"]["total_affected_shipments"] > 0:
            assert len(result.get("strategies", [])) == 3

    def test_risk_pipeline_still_works(self, db):
        """Existing run_simulation still works after Round 2 changes."""
        result = run_simulation(db, {
            "disruption_type": "port_closure",
            "location": "Mumbai Port",
            "duration_hours": 72,
            "severity": "high",
            "capacity_reduction": 1.0,
        })
        assert result is not None
        assert "simulation_id" in result
        assert result["impact_summary"]["total_affected_shipments"] > 0
        assert len(result["strategies"]) == 3

    def test_cold_chain_pipeline_compatible(self, db):
        """Cold chain risk still calculated in manual mode."""
        result = run_manual_simulation(
            db=db,
            conditions=[{
                "scope_type": "node",
                "scope_name": "Mumbai",
                "temperature_c": 45.0,  # extreme heat → cold chain risk
            }],
            direct_disruptions=[],
            interrupt_connection_ids=[],
        )
        # cold_chain_at_risk should be a valid integer
        assert isinstance(result["impact_summary"]["cold_chain_at_risk"], int)

    def test_fleet_summary_in_manual_result(self, db):
        """Fleet summary is present in manual simulation result."""
        result = run_manual_simulation(
            db=db,
            conditions=[{
                "scope_type": "node",
                "scope_name": "Mumbai",
                "rainfall_mm": 80.0,
            }],
            direct_disruptions=[],
            interrupt_connection_ids=[],
        )
        assert "fleet_summary" in result
        assert result["fleet_summary"]["total_vehicles"] > 0


# ── 6. Compound Events ────────────────────────────────────────────────────────

class TestCompoundEvents:

    def test_compound_conditions_plus_direct_disruption(self, db):
        """Compound: multiple conditions + direct disruption → all processed."""
        result = run_manual_simulation(
            db=db,
            conditions=[
                {"scope_type": "node", "scope_name": "Mumbai", "rainfall_mm": 80.0},
                {"scope_type": "node", "scope_name": "Mumbai", "road_condition": 0.25},
                {"scope_type": "node", "scope_name": "Mumbai", "traffic_level": 0.88},
            ],
            direct_disruptions=[{
                "disruption_type": "road_blockage",
                "scope_type": "node",
                "scope_name": "Mumbai",
                "severity": "high",
                "duration_hours": 24.0,
                "capacity_reduction": 1.0,
            }],
            interrupt_connection_ids=[],
            run_label="Compound events test",
        )
        causal = result["causal_info"]
        # Should have violations from conditions + direct disruption
        assert len(causal["generated_disruptions"]) >= 4  # 3 conditions + 1 direct

    def test_causal_engine_multiple_scopes(self):
        """Conditions on different scopes → disruptions on each scope."""
        result = run_causal_engine([
            {"scope_type": "node", "scope_name": "Mumbai", "rainfall_mm": 90.0},
            {"scope_type": "node", "scope_name": "Chennai", "weather_severity": 0.85},
            {"scope_type": "region", "scope_name": "Western Coast", "port_congestion": 0.80},
        ], [])
        scopes = {d.scope_name for d in result.generated_disruptions}
        assert len(scopes) >= 2  # at least two different scopes

    def test_multiple_events_representable_in_model(self, db):
        """Data model supports multiple active events for one simulation."""
        result = run_manual_simulation(
            db=db,
            conditions=[
                {"scope_type": "node", "scope_name": "Kolkata", "rainfall_mm": 85.0},
                {"scope_type": "node", "scope_name": "Kolkata", "weather_severity": 0.8},
            ],
            direct_disruptions=[
                {
                    "disruption_type": "flood",
                    "scope_type": "node",
                    "scope_name": "Kolkata",
                    "severity": "high",
                    "duration_hours": 48.0,
                    "capacity_reduction": 0.9,
                }
            ],
            interrupt_connection_ids=[],
        )
        sim_id = result["simulation_id"]
        events = get_run_events(db, sim_id)
        # Multiple events should exist in sequence
        assert len(events) >= 3
        sequences = [e["sequence"] for e in events]
        # Sequences should be ordered
        assert sequences == sorted(sequences)


# ── 7. History / Persistence ──────────────────────────────────────────────────

class TestHistoryPersistence:

    def test_manual_history_returns_list(self, db):
        """get_manual_run_history returns a list."""
        history = get_manual_run_history(db)
        assert isinstance(history, list)

    def test_event_records_have_required_fields(self, db):
        """Each event record has required fields."""
        # Run a simulation first
        result = run_manual_simulation(
            db=db,
            conditions=[{"scope_type": "node", "scope_name": "Surat", "rainfall_mm": 70.0}],
            direct_disruptions=[],
            interrupt_connection_ids=[],
        )
        sim_id = result["simulation_id"]
        events = get_run_events(db, sim_id)
        for e in events:
            assert "event_id" in e
            assert "simulation_id" in e
            assert "sequence" in e
            assert "stage" in e
            assert "event_type" in e
            assert "summary" in e

    def test_history_entry_has_mode_manual(self, db):
        """History entries from Manual Mode have mode='manual'."""
        result = run_manual_simulation(
            db=db,
            conditions=[{"scope_type": "node", "scope_name": "Nagpur", "traffic_level": 0.9}],
            direct_disruptions=[],
            interrupt_connection_ids=[],
        )
        sim_id = result["simulation_id"]
        history = get_manual_run_history(db)
        entry = next((h for h in history if h["simulation_id"] == sim_id), None)
        assert entry is not None
        assert entry["mode"] == "manual"

    def test_condition_state_records_correct_values(self, db):
        """ConditionState records persist all condition values accurately."""
        unique_name = f"TestNode_{uuid.uuid4().hex[:8]}"
        run_manual_simulation(
            db=db,
            conditions=[{
                "scope_type": "node",
                "scope_name": unique_name,
                "rainfall_mm": 75.0,
                "humidity_pct": 92.0,
                "temperature_c": 35.0,
                "traffic_level": 0.75,
                "road_condition": 0.35,
                "port_congestion": 0.72,
                "weather_severity": 0.68,
            }],
            direct_disruptions=[],
            interrupt_connection_ids=[],
        )
        cs = db.query(ConditionState).filter(
            ConditionState.scope_name == unique_name
        ).first()
        assert cs is not None
        assert cs.rainfall_mm == 75.0
        assert cs.humidity_pct == 92.0
        assert cs.temperature_c == 35.0
        assert cs.traffic_level == 0.75
        assert abs(cs.road_condition - 0.35) < 0.01
        assert abs(cs.port_congestion - 0.72) < 0.01
        assert abs(cs.weather_severity - 0.68) < 0.01
