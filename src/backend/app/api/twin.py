"""
Digital Twin State API — ChainMind AI Round 2 Prompt 3

Provides a unified snapshot of the supply-chain digital twin state that the
frontend animated Digital Twin component consumes.

GET  /api/twin/state   — Full network state snapshot
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.database.models import (
    NetworkConnection, Route, Shipment, Port, Warehouse,
    SimulationRun, SimulationResult, AutoModeRun,
)
from app.simulation.auto_mode_controller import get_auto_controller

router = APIRouter()
logger = logging.getLogger(__name__)


# Node coordinates — shared with frontend (must stay in sync)
NODE_COORDS: Dict[str, Dict[str, float]] = {
    "Mumbai":        {"lat": 18.922, "lon": 72.835},
    "Mumbai Port":   {"lat": 18.922, "lon": 72.835},
    "JNPT":          {"lat": 18.951, "lon": 72.949},
    "Mundra":        {"lat": 22.839, "lon": 69.722},
    "Kandla":        {"lat": 23.033, "lon": 70.217},
    "Ahmedabad":     {"lat": 23.022, "lon": 72.571},
    "Surat":         {"lat": 21.170, "lon": 72.831},
    "Delhi":         {"lat": 28.614, "lon": 77.209},
    "Jaipur":        {"lat": 26.912, "lon": 75.787},
    "Lucknow":       {"lat": 26.847, "lon": 80.946},
    "Nagpur":        {"lat": 21.146, "lon": 79.088},
    "Hyderabad":     {"lat": 17.385, "lon": 78.487},
    "Chennai":       {"lat": 13.084, "lon": 80.293},
    "Bengaluru":     {"lat": 12.972, "lon": 77.595},
    "Kochi":         {"lat": 9.931,  "lon": 76.267},
    "Kolkata":       {"lat": 22.573, "lon": 88.364},
    "Visakhapatnam": {"lat": 17.687, "lon": 83.219},
    "Pune":          {"lat": 18.520, "lon": 73.857},
}


def _node_type(name: str) -> str:
    """Classify a node by its name."""
    lower = name.lower()
    if any(p in lower for p in ["port", "jnpt", "mundra", "kandla", "kochi", "visakhapatnam", "chennai", "kolkata"]):
        return "port"
    if name in ("Mumbai", "Delhi", "Ahmedabad", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune"):
        return "city"
    return "warehouse"


@router.get("/twin/state")
async def get_twin_state(db: Session = Depends(get_db)):
    """
    Return a complete snapshot of the digital twin network state.

    Includes:
    - nodes (ports, warehouses, cities) with coordinates and status
    - connections with current status (available / degraded / unavailable)
    - active shipments with estimated position on network
    - current simulation state
    - auto mode state
    """

    # ── 1. Build node list from ports + known coords ─────────────────────────
    ports_db = db.query(Port).all()
    port_map: Dict[str, Dict] = {}
    for p in ports_db:
        port_map[p.name] = {
            "id": p.port_id,
            "name": p.name,
            "city": p.city,
            "lat": p.latitude,
            "lon": p.longitude,
            "type": "port",
            "congestion": p.congestion,
            "status": p.operational_status,
            "risk_score": None,
        }
        port_map[p.city] = port_map[p.name]  # alias

    # Add cities that appear in NODE_COORDS but aren't in ports table
    nodes: List[Dict] = []
    seen_names: set = set()
    for name, coords in NODE_COORDS.items():
        key = name.lower()
        if key in seen_names:
            continue
        seen_names.add(key)

        if name in port_map:
            n = port_map[name].copy()
        elif name in [p["city"] for p in port_map.values()]:
            # city of a port — use port entry
            n = next((v for v in port_map.values() if v["city"] == name), None)
            if n is None:
                continue
            n = n.copy()
            n["name"] = name
        else:
            n = {
                "id": name.replace(" ", "_").lower(),
                "name": name,
                "city": name,
                "lat": coords["lat"],
                "lon": coords["lon"],
                "type": _node_type(name),
                "congestion": 0.3,
                "status": "operational",
                "risk_score": None,
            }
        nodes.append(n)

    # ── 2. Connections ────────────────────────────────────────────────────────
    connections_db = db.query(NetworkConnection).all()
    connections: List[Dict] = []
    disrupted_nodes: set = set()
    alternative_connection_ids: set = set()

    # find last simulation to get alternative routes info
    last_sim = (
        db.query(SimulationRun)
        .filter(SimulationRun.status == "completed")
        .order_by(SimulationRun.created_at.desc())
        .first()
    )
    alt_route_ids: set = set()
    sim_location: Optional[str] = None
    sim_strategy: Optional[str] = None
    sim_severity: Optional[str] = None
    sim_disrupted_route_ids: set = set()

    if last_sim:
        sim_location = last_sim.location
        sim_strategy = last_sim.recommended_strategy
        sim_severity = last_sim.severity
        # get alternative route ids from simulation results
        try:
            sim_results = (
                db.query(SimulationResult)
                .filter(SimulationResult.simulation_id == last_sim.simulation_id)
                .all()
            )
            for sr in sim_results:
                if sr.original_route_id:
                    sim_disrupted_route_ids.add(sr.original_route_id)
                if sr.alternative_route_id:
                    alt_route_ids.add(sr.alternative_route_id)
        except Exception:
            pass

    for c in connections_db:
        is_disrupted = c.status in ("unavailable", "degraded")
        if is_disrupted:
            disrupted_nodes.add(c.from_node.lower())
            disrupted_nodes.add(c.to_node.lower())
        conn_dict = {
            "id": c.connection_id,
            "name": c.name,
            "from": c.from_node,
            "to": c.to_node,
            "mode": c.transport_mode,
            "distance_km": c.distance_km,
            "status": c.status,          # available / degraded / unavailable
            "disruption_reason": c.disruption_reason,
            "route_id": c.route_id,
            "is_alternative": c.route_id in alt_route_ids if c.route_id else False,
        }
        connections.append(conn_dict)

    # If no network connections exist, fall back to routes
    if not connections:
        routes_db = db.query(Route).filter(Route.is_active == True).all()
        for r in routes_db:
            is_disrupted = (r.route_id in sim_disrupted_route_ids)
            status = "unavailable" if is_disrupted else "available"
            connections.append({
                "id": f"route_{r.route_id}",
                "name": r.name or f"{r.origin}→{r.destination}",
                "from": r.origin,
                "to": r.destination,
                "mode": r.transport_mode or "truck",
                "distance_km": r.distance_km or 0,
                "status": status,
                "disruption_reason": None,
                "route_id": r.route_id,
                "is_alternative": r.route_id in alt_route_ids,
            })
            if is_disrupted:
                disrupted_nodes.add(r.origin.lower())
                disrupted_nodes.add(r.destination.lower())

    # ── 3. Shipments ─────────────────────────────────────────────────────────
    shipments_db = db.query(Shipment).all()
    shipments: List[Dict] = []
    for s in shipments_db:
        risk_level = _score_to_level(s.risk_score or 0)
        shipments.append({
            "id": s.shipment_id,
            "origin": s.origin,
            "destination": s.destination,
            "status": s.status,
            "progress_pct": s.progress_pct or 0,
            "risk_score": s.risk_score or 0,
            "risk_level": risk_level,
            "delay_hours": s.estimated_delay_hours or 0,
            "temperature_sensitive": s.temperature_sensitive,
            "priority": s.priority,
            "cargo_type": s.cargo_type,
            "is_affected": s.status in ("delayed", "held"),
        })

    # ── 4. Simulation state ──────────────────────────────────────────────────
    sim_state: Dict[str, Any] = {"active": False}
    if last_sim:
        sim_state = {
            "active": True,
            "simulation_id": last_sim.simulation_id,
            "location": sim_location,
            "disruption_type": last_sim.disruption_type,
            "severity": sim_severity,
            "strategy": sim_strategy,
            "affected_shipments": last_sim.total_affected_shipments or 0,
            "average_delay_hours": last_sim.average_delay_hours or 0,
            "disrupted_route_ids": list(sim_disrupted_route_ids),
            "alternative_route_ids": list(alt_route_ids),
            "created_at": last_sim.created_at.isoformat() if last_sim.created_at else None,
        }

    # ── 5. Auto Mode state ───────────────────────────────────────────────────
    controller = get_auto_controller()
    ctrl_status = controller.status()
    auto_state = {
        "status": ctrl_status["status"],
        "phase": ctrl_status["phase"],
        "location": ctrl_status["location"],
        "total_cycles": ctrl_status["total_cycles"],
        "crises_detected": ctrl_status["crises_detected"],
        "current_conditions": ctrl_status.get("current_conditions"),
    }

    # ── 6. Overall network health ─────────────────────────────────────────────
    total_conns = len(connections)
    disrupted_conns = sum(1 for c in connections if c["status"] == "unavailable")
    degraded_conns = sum(1 for c in connections if c["status"] == "degraded")
    delayed_shipments = sum(1 for s in shipments if s["is_affected"])
    critical_shipments = sum(1 for s in shipments if s["risk_level"] in ("critical", "high"))

    network_health = "normal"
    if disrupted_conns > 0 or delayed_shipments > 5:
        network_health = "crisis"
    elif degraded_conns > 2 or delayed_shipments > 2:
        network_health = "warning"

    # Check if recovery strategy is active
    has_recovery = sim_state.get("active") and bool(sim_state.get("strategy"))
    if has_recovery and disrupted_conns == 0:
        network_health = "recovered"
    elif has_recovery:
        network_health = "recovery"

    return {
        "nodes": nodes,
        "connections": connections,
        "shipments": shipments,
        "simulation": sim_state,
        "auto_mode": auto_state,
        "network_health": network_health,
        "stats": {
            "total_nodes": len(nodes),
            "total_connections": total_conns,
            "disrupted_connections": disrupted_conns,
            "degraded_connections": degraded_conns,
            "total_shipments": len(shipments),
            "delayed_shipments": delayed_shipments,
            "critical_shipments": critical_shipments,
            "alternative_routes_active": len(alt_route_ids),
        },
    }


def _score_to_level(score: float) -> str:
    if score >= 0.7:
        return "critical"
    if score >= 0.5:
        return "high"
    if score >= 0.3:
        return "medium"
    return "low"
