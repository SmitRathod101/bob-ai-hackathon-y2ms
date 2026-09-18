"""
Manual Mode Simulation Engine — ChainMind AI Round 2

Extends the existing run_simulation pipeline to support:
- Condition-driven causal disruption
- Direct disruption events
- Network connection interruption
- Multiple active events
- Structured SimulationEvent records

The pipeline is:
  INPUT (conditions + direct disruptions)
  → Causal Engine (conditions → disruptions, violations)
  → Connection interruption (mark unavailable, find dependent routes)
  → Merged scenario (worst disruption drives the existing engine)
  → run_simulation() (existing pipeline: affected shipments, delay, risk, recovery)
  → SimulationEvent persistence
  → Return combined result
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.database.models import (
    NetworkConnection, ConditionState, DirectDisruption,
    SimulationEvent, SimulationRun,
)
from app.simulation.engine import run_simulation
from app.simulation.causal_engine import run_causal_engine, CausalEngineResult
from app.simulation.network_connections import (
    bootstrap_connections_from_routes,
    interrupt_connection,
    get_routes_dependent_on_connection,
    build_graph_excluding_interrupted,
    list_connections,
)

logger = logging.getLogger(__name__)


# ── Public Entry Point ────────────────────────────────────────────────────────

def run_manual_simulation(
    db: Session,
    conditions: List[Dict[str, Any]],
    direct_disruptions: List[Dict[str, Any]],
    interrupt_connection_ids: List[str],
    run_label: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Execute a Manual Mode simulation.

    Parameters
    ----------
    conditions:
        List of condition state dicts (scope_name, scope_type, rainfall_mm, etc.)
    direct_disruptions:
        List of direct disruption dicts (disruption_type, scope_name, severity, etc.)
    interrupt_connection_ids:
        Connection IDs to immediately interrupt before running the simulation.
    run_label:
        Optional human-readable label for this run.

    Returns
    -------
    Combined result dict: causal_info + simulation result + event_log.
    """
    # Ensure connection table is bootstrapped
    bootstrap_connections_from_routes(db)

    # ── Step 1: Interrupt specified connections ───────────────────────────────
    connection_impact = {}
    interrupted_conn_details = []
    all_interrupted_route_ids: List[str] = []

    for conn_id in interrupt_connection_ids:
        try:
            conn_dict, aff_routes, aff_ships = interrupt_connection(
                db, conn_id,
                reason="Manual Mode: connection interrupted by operator",
                severity="high",
            )
            connection_impact[conn_id] = {
                "connection": conn_dict,
                "affected_route_ids": aff_routes,
                "affected_shipment_ids": aff_ships,
            }
            interrupted_conn_details.append(conn_dict)
            all_interrupted_route_ids.extend(aff_routes)
        except ValueError as e:
            logger.warning(f"Could not interrupt connection {conn_id}: {e}")

    # ── Step 2: Enrich direct_disruptions with connection scope names ─────────
    # When a connection is interrupted, add it as a direct disruption too
    for conn_id in interrupt_connection_ids:
        if conn_id in connection_impact:
            conn_dict = connection_impact[conn_id]["connection"]
            direct_disruptions = list(direct_disruptions) + [{
                "disruption_type": "connection_interruption",
                "scope_type": "connection",
                "scope_name": conn_dict.get("name", conn_id),
                "location": conn_dict.get("from_node", conn_id),
                "severity": "high",
                "causal_reason": f"Connection {conn_dict.get('name', conn_id)} interrupted by operator",
                "duration_hours": 24.0,
                "capacity_reduction": 1.0,
                "connection_id": conn_id,
            }]

    # ── Step 3: Run causal engine ─────────────────────────────────────────────
    causal_result: CausalEngineResult = run_causal_engine(conditions, direct_disruptions)

    if not causal_result.merged_scenario:
        # No conditions or disruptions → run with a minimal placeholder scenario
        causal_result.merged_scenario = {
            "disruption_type": "severe_weather",
            "location": _best_location(conditions, direct_disruptions),
            "duration_hours": 6.0,
            "severity": "low",
            "capacity_reduction": 0.1,
        }

    scenario = causal_result.merged_scenario
    # ── Step 4: Run the existing simulation engine ───────────────────────────
    # The existing engine uses build_logistics_graph(db, exclude_nodes=...)
    # We temporarily patch exclude_nodes with both causal + interrupted nodes.
    excluded_nodes = list(set(causal_result.excluded_nodes))
    scenario["_excluded_nodes"] = excluded_nodes  # passed through to engine if needed

    sim_result = run_simulation(db, scenario)

    if not sim_result:
        raise RuntimeError("Simulation engine returned no result")

    sim_id = sim_result["simulation_id"]

    # ── Step 5: Update SimulationRun to mark as Manual Mode ──────────────────
    sim_run = db.query(SimulationRun).filter(SimulationRun.simulation_id == sim_id).first()
    if sim_run:
        sim_run.mode = "manual"
        sim_run.run_label = run_label or f"Manual Run — {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
        sim_run.source_events_json = json.dumps({
            "conditions": conditions,
            "direct_disruptions": direct_disruptions,
            "interrupt_connection_ids": interrupt_connection_ids,
        })
        db.add(sim_run)

    # ── Step 6: Update DirectDisruption records with simulation_id ────────────
    db.query(DirectDisruption).filter(
        DirectDisruption.simulation_id.is_(None),
        DirectDisruption.connection_id.in_(interrupt_connection_ids),
    ).update({"simulation_id": sim_id})

    # ── Step 7: Persist ConditionState records ────────────────────────────────
    for cond in conditions:
        cs = ConditionState(
            condition_id=str(uuid.uuid4()),
            scope_type=cond.get("scope_type", "node"),
            scope_name=cond.get("scope_name", "Unknown"),
            rainfall_mm=cond.get("rainfall_mm"),
            humidity_pct=cond.get("humidity_pct"),
            temperature_c=cond.get("temperature_c"),
            traffic_level=cond.get("traffic_level"),
            road_condition=cond.get("road_condition"),
            port_congestion=cond.get("port_congestion"),
            weather_severity=cond.get("weather_severity"),
            wind_speed_kmh=cond.get("wind_speed_kmh"),
            visibility_km=cond.get("visibility_km"),
            simulation_id=sim_id,
        )
        db.add(cs)

    # ── Step 8: Persist SimulationEvent records ───────────────────────────────
    events = _build_simulation_events(
        sim_id=sim_id,
        causal_result=causal_result,
        sim_result=sim_result,
        interrupted_conn_details=interrupted_conn_details,
    )
    db.add_all(events)
    db.commit()

    # ── Step 9: Build combined response ──────────────────────────────────────
    sim_result["manual_mode"] = True
    sim_result["run_label"] = run_label
    sim_result["causal_info"] = {
        "violations": [
            {
                "condition": v.condition_name,
                "scope": v.scope_name,
                "value": v.value,
                "threshold": v.threshold_value,
                "severity": v.severity,
                "consequence": v.consequence,
            }
            for v in causal_result.violations
        ],
        "generated_disruptions": [
            {
                "disruption_type": d.disruption_type,
                "scope_name": d.scope_name,
                "severity": d.severity,
                "causal_reason": d.causal_reason,
                "duration_hours": d.duration_hours,
                "capacity_reduction": d.capacity_reduction,
            }
            for d in causal_result.generated_disruptions
        ],
        "causal_narrative": causal_result.causal_narrative,
        "event_log": causal_result.event_log,
    }
    sim_result["connection_impact"] = {
        conn_id: {
            "connection": v["connection"],
            "affected_route_count": len(v["affected_route_ids"]),
            "affected_shipment_count": len(v["affected_shipment_ids"]),
            "affected_route_ids": v["affected_route_ids"],
            "affected_shipment_ids": v["affected_shipment_ids"],
        }
        for conn_id, v in connection_impact.items()
    }
    sim_result["simulation_events"] = [
        {
            "event_id": e.event_id,
            "sequence": e.sequence,
            "stage": e.stage,
            "event_type": e.event_type,
            "severity": e.severity,
            "affected_entity": e.affected_entity,
            "summary": e.summary,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        }
        for e in events
    ]

    logger.info(
        f"Manual simulation {sim_id} complete: "
        f"{len(conditions)} conditions, {len(direct_disruptions)} disruptions, "
        f"{len(interrupt_connection_ids)} connections interrupted"
    )
    return sim_result


# ── Event Builder ─────────────────────────────────────────────────────────────

def _build_simulation_events(
    sim_id: str,
    causal_result: CausalEngineResult,
    sim_result: Dict[str, Any],
    interrupted_conn_details: List[Dict[str, Any]],
) -> List[SimulationEvent]:
    """Build the SimulationEvent timeline for this run."""
    events: List[SimulationEvent] = []
    seq = 0

    def make_event(stage, event_type, entity, scope, severity, summary, payload=None):
        nonlocal seq
        e = SimulationEvent(
            event_id=str(uuid.uuid4()),
            simulation_id=sim_id,
            sequence=seq,
            stage=stage,
            event_type=event_type,
            severity=severity,
            affected_entity=entity,
            affected_scope=scope,
            causal_source="manual_mode",
            summary=summary,
            payload_json=json.dumps(payload) if payload else None,
            timestamp=datetime.utcnow(),
        )
        seq += 1
        return e

    # ① Condition changes
    for cond in causal_result.input_conditions:
        entity = cond.get("scope_name", "Unknown")
        scope_type = cond.get("scope_type", "node")
        conditions_set = {k: v for k, v in cond.items()
                          if k not in ("scope_name", "scope_type") and v is not None}
        if conditions_set:
            events.append(make_event(
                "condition_changed", "condition_changed",
                entity, scope_type, "info",
                f"Conditions updated at {entity}: {', '.join(f'{k}={v}' for k, v in conditions_set.items())}",
                cond,
            ))

    # ② Condition violations
    for v in causal_result.violations:
        events.append(make_event(
            "condition_changed", "threshold_violated",
            v.scope_name, "node", v.severity,
            f"Threshold violated: {v.condition_name} = {v.value:.1f} at {v.scope_name} → {v.consequence}",
            {"condition": v.condition_name, "value": v.value, "threshold": v.threshold_value},
        ))

    # ③ Connection interruptions
    for conn in interrupted_conn_details:
        events.append(make_event(
            "disruption_detected", "connection_interrupted",
            conn.get("name", "connection"), "connection", "high",
            f"Connection interrupted: {conn.get('name')} ({conn.get('from_node')}→{conn.get('to_node')})",
            conn,
        ))

    # ④ Disruptions detected
    for d in causal_result.generated_disruptions:
        events.append(make_event(
            "disruption_detected", "disruption_generated",
            d.scope_name, d.scope_type, d.severity,
            f"{d.disruption_type.replace('_', ' ').title()} at {d.scope_name} [{d.severity}]: {d.causal_reason[:120]}",
            {"disruption_type": d.disruption_type, "severity": d.severity, "reason": d.causal_reason},
        ))

    # ⑤ Impact analyzed
    impact = sim_result.get("impact_summary", {})
    events.append(make_event(
        "impact_analyzed", "impact_analyzed",
        sim_result.get("scenario", {}).get("location", "network"), "network",
        _score_to_severity(impact.get("total_affected_shipments", 0)),
        f"Impact: {impact.get('total_affected_shipments', 0)} shipments affected, "
        f"avg delay {impact.get('average_delay_hours', 0):.1f}h, "
        f"₹{impact.get('total_cargo_value_exposed', 0):,.0f} exposed",
        impact,
    ))

    # ⑥ Risk predicted
    risk_dist = sim_result.get("risk_distribution", {})
    critical = risk_dist.get("critical", 0)
    high = risk_dist.get("high", 0)
    severity = "high" if (critical + high) > 5 else "medium" if (critical + high) > 0 else "low"
    events.append(make_event(
        "risk_predicted", "risk_predicted",
        "all_affected_shipments", "network", severity,
        f"Risk distribution: {critical} critical, {high} high, "
        f"{risk_dist.get('medium', 0)} medium, {risk_dist.get('low', 0)} low",
        risk_dist,
    ))

    # ⑦ Strategy generated
    strategies = sim_result.get("strategies", [])
    rec = sim_result.get("recommended_strategy", {})
    events.append(make_event(
        "strategy_generated", "strategy_generated",
        "recovery_engine", "system", "info",
        f"{len(strategies)} recovery strategies generated. "
        f"Recommended: {rec.get('name', 'Balanced') if rec else 'None'}",
        {"strategy_count": len(strategies), "recommended": rec.get("strategy_type") if rec else None},
    ))

    # ⑧ Decision made
    if rec:
        events.append(make_event(
            "decision_made", "decision_made",
            "ai_engine", "system", "info",
            f"AI Decision: {rec.get('name', 'N/A')} — "
            f"cost ₹{rec.get('additional_cost_inr', 0):,.0f}, "
            f"delay {rec.get('average_delay_hours', 0):.1f}h",
            rec,
        ))

    return events


# ── History ────────────────────────────────────────────────────────────────────

def get_manual_run_history(db: Session, limit: int = 50) -> List[Dict[str, Any]]:
    """Return manual simulation run history."""
    runs = (
        db.query(SimulationRun)
        .filter(SimulationRun.mode == "manual")
        .order_by(SimulationRun.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for r in runs:
        source = {}
        if r.source_events_json:
            try:
                source = json.loads(r.source_events_json)
            except Exception:
                pass
        result.append({
            "simulation_id": r.simulation_id,
            "run_label": r.run_label,
            "mode": r.mode,
            "scenario_name": r.scenario_name,
            "disruption_type": r.disruption_type,
            "location": r.location,
            "duration_hours": r.duration_hours,
            "severity": r.severity,
            "total_affected_shipments": r.total_affected_shipments,
            "total_cargo_value_exposed": r.total_cargo_value_exposed,
            "average_delay_hours": r.average_delay_hours,
            "recommended_strategy": r.recommended_strategy,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "source_conditions_count": len(source.get("conditions", [])),
            "source_disruptions_count": len(source.get("direct_disruptions", [])),
            "interrupted_connections": source.get("interrupt_connection_ids", []),
        })
    return result


def get_run_events(db: Session, simulation_id: str) -> List[Dict[str, Any]]:
    """Return the ordered event timeline for a simulation run."""
    events = (
        db.query(SimulationEvent)
        .filter(SimulationEvent.simulation_id == simulation_id)
        .order_by(SimulationEvent.sequence)
        .all()
    )
    result = []
    for e in events:
        payload = None
        if e.payload_json:
            try:
                payload = json.loads(e.payload_json)
            except Exception:
                pass
        result.append({
            "event_id": e.event_id,
            "simulation_id": e.simulation_id,
            "sequence": e.sequence,
            "stage": e.stage,
            "event_type": e.event_type,
            "severity": e.severity,
            "affected_entity": e.affected_entity,
            "affected_scope": e.affected_scope,
            "causal_source": e.causal_source,
            "summary": e.summary,
            "payload": payload,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        })
    return result


# ── Helpers ───────────────────────────────────────────────────────────────────

def _best_location(
    conditions: List[Dict[str, Any]],
    direct_disruptions: List[Dict[str, Any]],
) -> str:
    """Pick the best location name from inputs."""
    for c in conditions:
        if c.get("scope_name"):
            return c["scope_name"]
    for d in direct_disruptions:
        if d.get("scope_name"):
            return d["scope_name"]
        if d.get("location"):
            return d["location"]
    return "Mumbai"


def _score_to_severity(count: int) -> str:
    if count >= 20:
        return "high"
    elif count >= 5:
        return "medium"
    return "low"
