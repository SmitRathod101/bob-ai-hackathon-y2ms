"""
Route Optimization Service using NetworkX graph algorithms.

Builds a weighted graph of the logistics network and provides:
- Shortest path finding
- Weighted path (time + congestion + risk + cost)
- Alternative route discovery
- Route scoring
"""

import networkx as nx
from typing import List, Optional, Dict, Tuple
from sqlalchemy.orm import Session
from app.database.models import Route, Port


# Route score weights (configurable)
WEIGHT_TIME = 0.35
WEIGHT_CONGESTION = 0.30
WEIGHT_RISK = 0.20
WEIGHT_COST = 0.15


def build_logistics_graph(db: Session, exclude_nodes: List[str] = None) -> nx.DiGraph:
    """
    Build a directed weighted graph from routes in the database.
    exclude_nodes: list of port/city names to exclude (simulate closures).
    """
    G = nx.DiGraph()
    routes = db.query(Route).filter(Route.is_active == True).all()
    exclude_nodes = exclude_nodes or []

    for route in routes:
        origin = route.origin
        dest = route.destination

        # Skip routes involving excluded nodes
        if origin in exclude_nodes or dest in exclude_nodes:
            continue

        # Calculate composite weight
        # Normalize: time in hours (0-30), congestion (0-1), risk (0-1), cost (cost_per_km * dist / 10000)
        norm_time = route.normal_time_hours / 30.0
        norm_cost = (route.cost_per_km * route.distance_km) / 500000.0
        weight = (
            WEIGHT_TIME * norm_time
            + WEIGHT_CONGESTION * route.congestion
            + WEIGHT_RISK * route.risk_score
            + WEIGHT_COST * norm_cost
        )

        G.add_edge(
            origin,
            dest,
            route_id=route.route_id,
            distance_km=route.distance_km,
            normal_time_hours=route.normal_time_hours,
            congestion=route.congestion,
            risk_score=route.risk_score,
            cost_per_km=route.cost_per_km,
            transport_mode=route.transport_mode,
            weight=weight,
        )

    return G


def find_best_route(
    graph: nx.DiGraph,
    origin: str,
    destination: str,
) -> Optional[Dict]:
    """Find the best route by composite score."""
    try:
        path = nx.shortest_path(graph, origin, destination, weight="weight")
        total_weight = nx.shortest_path_length(graph, origin, destination, weight="weight")
        return _path_to_details(graph, path, total_weight)
    except nx.NetworkXNoPath:
        return None
    except nx.NodeNotFound:
        return None


def find_k_best_routes(
    graph: nx.DiGraph,
    origin: str,
    destination: str,
    k: int = 3,
) -> List[Dict]:
    """Find k best routes by composite score."""
    try:
        paths = list(nx.shortest_simple_paths(graph, origin, destination, weight="weight"))
        results = []
        for path in paths[:k]:
            total_weight = sum(
                graph[path[i]][path[i+1]]["weight"]
                for i in range(len(path) - 1)
            )
            details = _path_to_details(graph, path, total_weight)
            if details:
                results.append(details)
        return results
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return []


def find_fastest_route(graph: nx.DiGraph, origin: str, destination: str) -> Optional[Dict]:
    """Find the route with minimum travel time."""
    try:
        path = nx.shortest_path(graph, origin, destination, weight="normal_time_hours")
        total_time = sum(
            graph[path[i]][path[i+1]]["normal_time_hours"]
            for i in range(len(path) - 1)
        )
        return _path_to_details(graph, path, total_time, score_type="time")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return None


def find_cheapest_route(graph: nx.DiGraph, origin: str, destination: str) -> Optional[Dict]:
    """Find the route with minimum cost."""
    # Use cost as weight: cost_per_km * distance_km
    G_cost = nx.DiGraph()
    for u, v, data in graph.edges(data=True):
        cost = data["cost_per_km"] * data["distance_km"]
        G_cost.add_edge(u, v, cost=cost, **data)

    try:
        path = nx.shortest_path(G_cost, origin, destination, weight="cost")
        total_cost = sum(
            G_cost[path[i]][path[i+1]]["cost"]
            for i in range(len(path) - 1)
        )
        return _path_to_details(graph, path, total_cost, score_type="cost")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return None


def _path_to_details(graph: nx.DiGraph, path: List[str], score: float, score_type: str = "composite") -> Optional[Dict]:
    """Convert a path list to a detailed route dict."""
    if not path or len(path) < 2:
        return None

    route_ids = []
    total_distance = 0.0
    total_time = 0.0
    total_cost = 0.0
    max_congestion = 0.0
    max_risk = 0.0
    modes = []

    for i in range(len(path) - 1):
        edge_data = graph[path[i]][path[i+1]]
        route_ids.append(edge_data.get("route_id", ""))
        total_distance += edge_data.get("distance_km", 0)
        total_time += edge_data.get("normal_time_hours", 0)
        total_cost += edge_data.get("cost_per_km", 10) * edge_data.get("distance_km", 0)
        max_congestion = max(max_congestion, edge_data.get("congestion", 0))
        max_risk = max(max_risk, edge_data.get("risk_score", 0))
        mode = edge_data.get("transport_mode", "truck")
        if mode not in modes:
            modes.append(mode)

    return {
        "path": path,
        "route_ids": route_ids,
        "total_distance_km": round(total_distance, 1),
        "total_time_hours": round(total_time, 1),
        "total_cost_inr": round(total_cost, 2),
        "max_congestion": round(max_congestion, 3),
        "max_risk": round(max_risk, 3),
        "transport_modes": modes,
        "score": round(score, 4),
        "score_type": score_type,
        "hops": len(path) - 1,
    }


def score_route(route: Route) -> float:
    """Score a single route record (lower = better)."""
    norm_time = route.normal_time_hours / 30.0
    norm_cost = (route.cost_per_km * route.distance_km) / 500000.0
    return (
        WEIGHT_TIME * norm_time
        + WEIGHT_CONGESTION * route.congestion
        + WEIGHT_RISK * route.risk_score
        + WEIGHT_COST * norm_cost
    )


def get_affected_routes_for_port(db: Session, port_name: str) -> List[str]:
    """Get all route IDs that directly involve a given port/city."""
    routes = db.query(Route).filter(
        (Route.origin == port_name) | (Route.destination == port_name)
    ).all()
    return [r.route_id for r in routes]


def get_alternative_routes(db: Session, graph: nx.DiGraph, origin: str, destination: str) -> List[Dict]:
    """Find alternative routes excluding any disrupted edges already removed from graph."""
    return find_k_best_routes(graph, origin, destination, k=3)
