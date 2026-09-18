"""
Network Connection Service — ChainMind AI Round 2

Manages the explicit connection/edge layer of the logistics network.
Supports connection interruption and its propagation into the route graph
and simulation pipeline.

A NetworkConnection maps 1:1 (when possible) to a Route record.
When a connection is interrupted:
  1. The connection is marked unavailable in network_connections.
  2. The linked route (if any) is excluded from the graph.
  3. The from_node/to_node pair is used to find dependent routes.
  4. Affected shipments and delay/risk are handled by the existing engine.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.database.models import NetworkConnection, Route, Shipment, DirectDisruption
from app.optimization.route_optimizer import build_logistics_graph, get_affected_routes_for_port

logger = logging.getLogger(__name__)


# ── Seed / Bootstrap ──────────────────────────────────────────────────────────

def bootstrap_connections_from_routes(db: Session) -> int:
    """
    Populate network_connections from the routes table if the table is empty.
    This ensures every route is represented as an addressable connection.
    Returns the number of connections created.
    """
    existing = db.query(NetworkConnection).count()
    if existing > 0:
        return 0

    routes = db.query(Route).filter(Route.is_active == True).all()
    created = 0
    for route in routes:
        conn = NetworkConnection(
            connection_id=f"conn_{route.route_id}",
            name=route.name or f"{route.origin}→{route.destination}",
            from_node=route.origin,
            to_node=route.destination,
            transport_mode=route.transport_mode or "truck",
            distance_km=route.distance_km or 0.0,
            normal_time_hours=route.normal_time_hours or 0.0,
            status="available",
            route_id=route.route_id,
        )
        db.add(conn)
        created += 1
    db.commit()
    logger.info(f"Bootstrapped {created} network connections from routes")
    return created


# ── Connection CRUD ───────────────────────────────────────────────────────────

def list_connections(db: Session, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return all connections, optionally filtered by status."""
    query = db.query(NetworkConnection)
    if status_filter:
        query = query.filter(NetworkConnection.status == status_filter)
    connections = query.order_by(NetworkConnection.from_node, NetworkConnection.to_node).all()
    return [_conn_to_dict(c) for c in connections]


def get_connection(db: Session, connection_id: str) -> Optional[Dict[str, Any]]:
    """Return a single connection by ID."""
    conn = db.query(NetworkConnection).filter(
        NetworkConnection.connection_id == connection_id
    ).first()
    return _conn_to_dict(conn) if conn else None


def interrupt_connection(
    db: Session,
    connection_id: str,
    reason: str,
    simulation_id: Optional[str] = None,
    severity: str = "high",
) -> Tuple[Dict[str, Any], List[str], List[str]]:
    """
    Mark a connection as unavailable and find downstream impacts.

    Returns
    -------
    (connection_dict, affected_route_ids, affected_shipment_ids)
    """
    conn = db.query(NetworkConnection).filter(
        NetworkConnection.connection_id == connection_id
    ).first()
    if not conn:
        raise ValueError(f"Connection {connection_id} not found")

    # Mark the connection
    conn.status = "unavailable"
    conn.disruption_reason = reason
    conn.disrupted_at = datetime.utcnow()
    db.add(conn)

    # Find routes that use this edge
    affected_route_ids = _find_routes_for_connection(db, conn)

    # Find affected shipments on those routes
    affected_shipment_ids = []
    if affected_route_ids:
        shipments = db.query(Shipment).filter(
            Shipment.route_id.in_(affected_route_ids),
            Shipment.status.notin_(["delivered"]),
        ).all()
        affected_shipment_ids = [s.shipment_id for s in shipments]

    # Create a DirectDisruption record
    dd = DirectDisruption(
        disruption_id=str(uuid.uuid4()),
        disruption_type="connection_interruption",
        scope_type="connection",
        scope_name=conn.name or f"{conn.from_node}→{conn.to_node}",
        severity=severity,
        severity_score={"low": 0.3, "medium": 0.6, "high": 0.9}.get(severity, 0.9),
        is_active=True,
        causal_source="manual",
        causal_reason=reason,
        connection_id=connection_id,
        simulation_id=simulation_id,
    )
    db.add(dd)
    db.commit()

    logger.info(
        f"Connection {connection_id} interrupted. "
        f"Affected routes: {len(affected_route_ids)}, shipments: {len(affected_shipment_ids)}"
    )
    return _conn_to_dict(conn), affected_route_ids, affected_shipment_ids


def restore_connection(db: Session, connection_id: str) -> Dict[str, Any]:
    """Restore a previously interrupted connection."""
    conn = db.query(NetworkConnection).filter(
        NetworkConnection.connection_id == connection_id
    ).first()
    if not conn:
        raise ValueError(f"Connection {connection_id} not found")

    conn.status = "available"
    conn.disruption_reason = None
    conn.restored_at = datetime.utcnow()
    db.add(conn)

    # Deactivate related DirectDisruption records
    db.query(DirectDisruption).filter(
        DirectDisruption.connection_id == connection_id,
        DirectDisruption.is_active == True,
    ).update({"is_active": False, "ended_at": datetime.utcnow()})

    db.commit()
    return _conn_to_dict(conn)


def get_unavailable_connections(db: Session) -> List[str]:
    """Return route_ids for all currently unavailable connections."""
    conns = db.query(NetworkConnection).filter(
        NetworkConnection.status == "unavailable",
        NetworkConnection.route_id.isnot(None),
    ).all()
    return [c.route_id for c in conns if c.route_id]


def get_excluded_nodes_from_connections(db: Session) -> List[str]:
    """
    Return node names that should be excluded from the graph
    because all their connections are unavailable.
    Typically used for full port/node closures.
    """
    # Not implemented for partial connection interruption — only full node exclusion
    # is handled at the route_optimizer level.
    return []


def build_graph_excluding_interrupted(db: Session, extra_exclude_nodes: List[str] = None) -> Any:
    """
    Build the logistics graph excluding any currently interrupted connections
    plus any extra excluded nodes.
    """
    extra_exclude_nodes = extra_exclude_nodes or []
    unavailable_route_ids = set(get_unavailable_connections(db))

    # Temporarily mark unavailable routes inactive in the graph query
    # by building the graph with a custom filter
    import networkx as nx
    graph = nx.DiGraph()
    routes = db.query(Route).filter(Route.is_active == True).all()

    from app.optimization.route_optimizer import WEIGHT_TIME, WEIGHT_CONGESTION, WEIGHT_RISK, WEIGHT_COST

    for route in routes:
        if route.route_id in unavailable_route_ids:
            continue  # skip interrupted connections
        origin = route.origin
        dest = route.destination
        if origin in extra_exclude_nodes or dest in extra_exclude_nodes:
            continue

        norm_time = route.normal_time_hours / 30.0
        norm_cost = (route.cost_per_km * route.distance_km) / 500000.0
        weight = (
            WEIGHT_TIME * norm_time
            + WEIGHT_CONGESTION * route.congestion
            + WEIGHT_RISK * route.risk_score
            + WEIGHT_COST * norm_cost
        )
        graph.add_edge(
            origin, dest,
            route_id=route.route_id,
            distance_km=route.distance_km,
            normal_time_hours=route.normal_time_hours,
            congestion=route.congestion,
            risk_score=route.risk_score,
            cost_per_km=route.cost_per_km,
            transport_mode=route.transport_mode,
            weight=weight,
        )
    return graph


def get_routes_dependent_on_connection(db: Session, connection_id: str) -> List[str]:
    """Find all route_ids that depend on a given connection."""
    conn = db.query(NetworkConnection).filter(
        NetworkConnection.connection_id == connection_id
    ).first()
    if not conn:
        return []
    return _find_routes_for_connection(db, conn)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _find_routes_for_connection(db: Session, conn: NetworkConnection) -> List[str]:
    """
    Find all route_ids affected by this connection being unavailable.
    This includes:
    1. The direct route_id (if the connection maps to a route)
    2. Any routes with origin == from_node and destination == to_node
    """
    route_ids = set()
    if conn.route_id:
        route_ids.add(conn.route_id)

    # Also find by node pair
    matching = db.query(Route).filter(
        Route.origin == conn.from_node,
        Route.destination == conn.to_node,
    ).all()
    for r in matching:
        route_ids.add(r.route_id)

    return list(route_ids)


def _conn_to_dict(conn: Optional[NetworkConnection]) -> Optional[Dict[str, Any]]:
    if not conn:
        return None
    return {
        "connection_id": conn.connection_id,
        "name": conn.name,
        "from_node": conn.from_node,
        "to_node": conn.to_node,
        "transport_mode": conn.transport_mode,
        "distance_km": conn.distance_km,
        "normal_time_hours": conn.normal_time_hours,
        "status": conn.status,
        "disruption_reason": conn.disruption_reason,
        "route_id": conn.route_id,
        "disrupted_at": conn.disrupted_at.isoformat() if conn.disrupted_at else None,
        "restored_at": conn.restored_at.isoformat() if conn.restored_at else None,
    }
