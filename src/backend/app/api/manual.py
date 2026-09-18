"""
Round 2 Manual Mode API — ChainMind AI

Endpoints:
  POST /api/manual/simulate         — Run a manual simulation
  GET  /api/manual/connections       — List all network connections
  GET  /api/manual/connections/{id}  — Get a single connection
  POST /api/manual/connections/{id}/interrupt  — Interrupt a connection
  POST /api/manual/connections/{id}/restore    — Restore a connection
  GET  /api/manual/nodes             — List all network nodes
  GET  /api/manual/history           — Manual run history
  GET  /api/manual/history/{sim_id}  — Single manual run with events
  GET  /api/manual/events/{sim_id}   — Event timeline for a run
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

from app.database.session import get_db
from app.database.models import Route, Port, Warehouse, SimulationRun, SimulationEvent
from app.simulation.manual_mode import (
    run_manual_simulation,
    get_manual_run_history,
    get_run_events,
)
from app.simulation.network_connections import (
    bootstrap_connections_from_routes,
    list_connections,
    get_connection,
    interrupt_connection,
    restore_connection,
)
from app.llm.explainer import generate_explanation

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Request / Response Schemas ────────────────────────────────────────────────

class ConditionInput(BaseModel):
    """Environmental/operational conditions for a region or node."""
    scope_type: str = Field("node", description="region / node / route / area")
    scope_name: str = Field(..., min_length=1, description="Name of the region or node")
    rainfall_mm: Optional[float] = Field(None, ge=0, le=500, description="Rainfall mm/hour")
    humidity_pct: Optional[float] = Field(None, ge=0, le=100, description="Humidity 0–100%")
    temperature_c: Optional[float] = Field(None, ge=-40, le=60, description="Temperature °C")
    traffic_level: Optional[float] = Field(None, ge=0, le=1, description="Traffic fraction 0–1")
    road_condition: Optional[float] = Field(None, ge=0, le=1, description="Road quality 0–1 (1=perfect)")
    port_congestion: Optional[float] = Field(None, ge=0, le=1, description="Port congestion 0–1")
    weather_severity: Optional[float] = Field(None, ge=0, le=1, description="Weather severity 0–1")
    wind_speed_kmh: Optional[float] = Field(None, ge=0, le=300)
    visibility_km: Optional[float] = Field(None, ge=0, le=100)


class DirectDisruptionInput(BaseModel):
    """A direct disruption event manually entered by the judge."""
    disruption_type: str = Field(..., description=(
        "landslide / flood / road_blockage / bridge_failure / port_closure / "
        "severe_weather_event / vehicle_breakdown / cold_chain_failure / "
        "connection_interruption"
    ))
    scope_type: str = Field("node", description="connection / node / route / region")
    scope_name: str = Field(..., description="Affected entity name")
    severity: str = Field("medium", pattern="^(low|medium|high)$")
    duration_hours: float = Field(24.0, gt=0, le=720)
    capacity_reduction: float = Field(1.0, ge=0, le=1)
    causal_reason: Optional[str] = None
    connection_id: Optional[str] = None


class ManualSimulationRequest(BaseModel):
    """Request body for the Manual Mode simulation endpoint."""
    conditions: List[ConditionInput] = Field(
        default_factory=list,
        description="Environmental/operational conditions to apply",
    )
    direct_disruptions: List[DirectDisruptionInput] = Field(
        default_factory=list,
        description="Direct disruption events",
    )
    interrupt_connection_ids: List[str] = Field(
        default_factory=list,
        description="Connection IDs to immediately interrupt",
    )
    run_label: Optional[str] = Field(None, max_length=200, description="Human label for this run")
    include_explanation: bool = Field(True, description="Generate AI explanation")

    class Config:
        json_schema_extra = {
            "example": {
                "conditions": [
                    {
                        "scope_type": "node",
                        "scope_name": "Mumbai",
                        "rainfall_mm": 80.0,
                        "road_condition": 0.3,
                        "weather_severity": 0.8,
                    }
                ],
                "direct_disruptions": [
                    {
                        "disruption_type": "landslide",
                        "scope_type": "node",
                        "scope_name": "Mumbai",
                        "severity": "high",
                        "duration_hours": 36.0,
                        "capacity_reduction": 1.0,
                        "causal_reason": "Heavy rainfall triggered landslide on NH-48",
                    }
                ],
                "interrupt_connection_ids": [],
                "run_label": "Mumbai monsoon scenario",
            }
        }


class ConnectionInterruptRequest(BaseModel):
    reason: str = Field(..., min_length=5, description="Why this connection is interrupted")
    severity: str = Field("high", pattern="^(low|medium|high)$")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/manual/simulate")
async def manual_simulate(
    request: ManualSimulationRequest,
    db: Session = Depends(get_db),
):
    """
    Run a Manual Mode simulation.

    The judge provides conditions and/or direct disruptions.
    The Causal Engine converts conditions into disruptions.
    Results come from the existing simulation pipeline.
    """
    # Ensure connections are bootstrapped so provided IDs will resolve
    bootstrap_connections_from_routes(db)

    # Validate that any provided connection IDs actually exist in the DB
    # (avoids silent failures and confusing 0-impact results)
    valid_conn_ids = []
    invalid_conn_ids = []
    for conn_id in request.interrupt_connection_ids:
        conn = get_connection(db, conn_id)
        if conn:
            valid_conn_ids.append(conn_id)
        else:
            invalid_conn_ids.append(conn_id)
            logger.warning(f"Connection ID {conn_id!r} not found in DB — skipping")

    if invalid_conn_ids:
        logger.warning(
            f"Skipped {len(invalid_conn_ids)} unknown connection IDs: {invalid_conn_ids}. "
            f"Using {len(valid_conn_ids)} valid connections."
        )

    # Require at least one meaningful input
    has_conditions = bool([c for c in request.conditions if c.scope_name])
    has_disruptions = bool([d for d in request.direct_disruptions if d.scope_name])
    has_connections = bool(valid_conn_ids)

    if not has_conditions and not has_disruptions and not has_connections:
        raise HTTPException(
            status_code=400,
            detail=(
                "Provide at least one condition with a scope_name, "
                "one direct disruption with a scope_name, "
                "or one valid connection ID to interrupt. "
                f"Connection IDs not found: {invalid_conn_ids or 'none provided'}."
            ),
        )

    conditions = [c.model_dump(exclude_none=True) for c in request.conditions]
    disruptions = [d.model_dump(exclude_none=True) for d in request.direct_disruptions]

    try:
        result = run_manual_simulation(
            db=db,
            conditions=conditions,
            direct_disruptions=disruptions,
            interrupt_connection_ids=valid_conn_ids,
            run_label=request.run_label,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Manual simulation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Simulation failed: {e}")

    # Generate LLM explanation — always produce a structurally complete response
    if request.include_explanation:
        try:
            explanation = await generate_explanation(result)
            result["explanation"] = explanation
        except Exception as e:
            logger.error(f"Explanation generation failed: {e}", exc_info=True)
            # Return a safe complete fallback — never leave explanation_basis missing
            result["explanation"] = {
                "explanation": "AI explanation unavailable for this run.",
                "crisis_summary": "Explanation generation failed. Simulation results above are valid.",
                "used_llm": False,
                "llm_provider": "none",
                "explanation_basis": {
                    "cost_reasoning": {"value": 0, "vs_cheapest": 0, "vs_fastest": 0, "label": "Unavailable"},
                    "delay_reasoning": {"value": 0, "vs_cheapest": 0, "vs_fastest": 0, "label": "Unavailable"},
                    "risk_reasoning": {"level": "unknown", "cold_chain_risk": 0, "cold_chain_count": 0, "label": "Unavailable"},
                    "cargo_reasoning": {"total_value": 0, "high_priority": 0, "label": "Unavailable"},
                    "fleet_reasoning": {"vehicles_required": 0, "available": 0, "label": "Unavailable"},
                },
            }

    return result


@router.get("/manual/connections")
def get_connections(
    status: Optional[str] = Query(None, description="Filter by status: available/degraded/unavailable"),
    db: Session = Depends(get_db),
):
    """List all network connections (edges between nodes)."""
    bootstrap_connections_from_routes(db)
    return list_connections(db, status_filter=status)


@router.get("/manual/connections/{connection_id}")
def get_connection_detail(connection_id: str, db: Session = Depends(get_db)):
    """Get details of a single network connection."""
    bootstrap_connections_from_routes(db)
    conn = get_connection(db, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail=f"Connection {connection_id} not found")
    return conn


@router.post("/manual/connections/{connection_id}/interrupt")
def interrupt_conn(
    connection_id: str,
    request: ConnectionInterruptRequest,
    db: Session = Depends(get_db),
):
    """
    Interrupt a network connection.

    This marks the connection as unavailable, finds dependent routes and
    shipments, and creates a DirectDisruption record.
    """
    bootstrap_connections_from_routes(db)
    try:
        conn_dict, route_ids, shipment_ids = interrupt_connection(
            db, connection_id, request.reason, severity=request.severity
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {
        "connection": conn_dict,
        "affected_route_ids": route_ids,
        "affected_shipment_count": len(shipment_ids),
        "affected_shipment_ids": shipment_ids,
        "message": f"Connection {connection_id} interrupted. {len(route_ids)} routes affected.",
    }


@router.post("/manual/connections/{connection_id}/restore")
def restore_conn(connection_id: str, db: Session = Depends(get_db)):
    """Restore an interrupted connection to available status."""
    bootstrap_connections_from_routes(db)
    try:
        conn_dict = restore_connection(db, connection_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"connection": conn_dict, "message": f"Connection {connection_id} restored."}


@router.get("/manual/nodes")
def get_nodes(db: Session = Depends(get_db)):
    """
    List all known network nodes (ports + warehouse cities + route endpoints).
    Used by the Manual Mode UI to populate the scope selector.
    """
    node_set = set()

    # From ports
    ports = db.query(Port).all()
    for p in ports:
        node_set.add(p.city)
        node_set.add(p.name)

    # From routes
    routes = db.query(Route).filter(Route.is_active == True).all()
    for r in routes:
        node_set.add(r.origin)
        node_set.add(r.destination)

    # From warehouses
    warehouses = db.query(Warehouse).all()
    for w in warehouses:
        node_set.add(w.city)

    # Clean up empty strings
    nodes = sorted(n for n in node_set if n and len(n) > 1)

    return {"nodes": nodes, "count": len(nodes)}


@router.get("/manual/history")
def manual_history(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Return Manual Mode simulation history."""
    return get_manual_run_history(db, limit=limit)


@router.get("/manual/history/{simulation_id}")
def manual_history_detail(simulation_id: str, db: Session = Depends(get_db)):
    """Return a single Manual Mode run with its event timeline."""
    sim = db.query(SimulationRun).filter(SimulationRun.simulation_id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail=f"Simulation {simulation_id} not found")

    events = get_run_events(db, simulation_id)
    return {
        "simulation_id": sim.simulation_id,
        "run_label": sim.run_label,
        "mode": sim.mode,
        "disruption_type": sim.disruption_type,
        "location": sim.location,
        "duration_hours": sim.duration_hours,
        "severity": sim.severity,
        "total_affected_shipments": sim.total_affected_shipments,
        "total_cargo_value_exposed": sim.total_cargo_value_exposed,
        "average_delay_hours": sim.average_delay_hours,
        "recommended_strategy": sim.recommended_strategy,
        "status": sim.status,
        "created_at": sim.created_at.isoformat() if sim.created_at else None,
        "events": events,
    }


@router.get("/manual/events/{simulation_id}")
def get_simulation_events(simulation_id: str, db: Session = Depends(get_db)):
    """Return the ordered event timeline for any simulation run."""
    events = get_run_events(db, simulation_id)
    if not events:
        raise HTTPException(status_code=404, detail=f"No events found for simulation {simulation_id}")
    return {"simulation_id": simulation_id, "events": events}
