"""
Core Simulation Engine — ChainMind AI

Implements the Supply Chain Crisis Simulator.

Pipeline:
  1. Load current digital twin state
  2. Apply disruption scenario
  3. Identify directly affected assets (shipments, routes)
  4. Calculate cascading impact on indirectly affected shipments
  5. Calculate delay per affected shipment (with ML fallback)
  6. Calculate cargo exposure
  7. Score risk per shipment
  8. Evaluate cold-chain risk
  9. Evaluate fleet availability
 10. Find alternative routes
 11. Generate recovery strategies
 12. Score and rank strategies
 13. Return structured SimulationOutput

Deterministic core — LLM handles explanation/action plan separately.
"""

import uuid
import logging
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.database.models import (
    Port, Warehouse, Route, Shipment, Fleet,
    SimulationRun, SimulationResult, RecoveryStrategy,
)
from app.simulation.risk_scorer import (
    calculate_risk_score, calculate_cold_chain_risk, score_to_level
)
from app.optimization.route_optimizer import (
    build_logistics_graph, find_best_route, find_fastest_route,
    find_cheapest_route, get_affected_routes_for_port,
)
from app.optimization.fleet_optimizer import (
    find_available_fleet, calculate_fleet_requirements, get_fleet_summary,
)

logger = logging.getLogger(__name__)

# Severity score mapping
SEVERITY_SCORES = {"low": 0.3, "medium": 0.6, "high": 0.9}

# Delay multipliers by severity (additional factor on top of base disruption)
DELAY_MULTIPLIERS = {"low": 1.2, "medium": 1.6, "high": 2.2}

# Cost multipliers for rerouting
REROUTE_COST_FACTOR = {"low": 1.1, "medium": 1.3, "high": 1.6}


def run_simulation(db: Session, scenario: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main simulation entry point.

    scenario keys:
        disruption_type: str
        location: str
        duration_hours: float
        severity: str (low/medium/high)
        capacity_reduction: float (0-1, fraction blocked)
        delay_multiplier: float (optional override)
        cost_multiplier: float (optional override)
        temperature_risk_multiplier: float
    """
    sim_id = str(uuid.uuid4())
    started_at = datetime.utcnow()

    logger.info(f"[{sim_id}] Starting simulation: {scenario}")

    disruption_type = scenario["disruption_type"]
    location = scenario["location"]
    duration_hours = float(scenario["duration_hours"])
    severity = scenario.get("severity", "medium").lower()
    severity_score = SEVERITY_SCORES.get(severity, 0.6)
    capacity_reduction = float(scenario.get("capacity_reduction", 1.0))
    delay_mult = float(scenario.get("delay_multiplier", DELAY_MULTIPLIERS[severity]))
    cost_mult = float(scenario.get("cost_multiplier", REROUTE_COST_FACTOR[severity]))
    temp_risk_mult = float(scenario.get("temperature_risk_multiplier", 1.0 + severity_score * 0.5))

    # ── Step 1: Determine affected nodes ─────────────────────────────────────
    # For port closures, find all routes connected to that port
    # For route closures, find the specific route
    # For warehouse disruptions, find routes to/from that warehouse
    disrupted_nodes = []
    disrupted_route_ids = []

    if disruption_type == "port_closure":
        # Clean the location name for matching
        port_name = _normalize_location(location)
        disrupted_nodes = [port_name]
        disrupted_route_ids = get_affected_routes_for_port(db, port_name)
        logger.info(f"[{sim_id}] Port closure: {port_name}, affected routes: {len(disrupted_route_ids)}")

    elif disruption_type == "route_closure":
        route = db.query(Route).filter(
            Route.name.ilike(f"%{location}%")
        ).first()
        if route:
            disrupted_route_ids = [route.route_id]

    elif disruption_type == "warehouse_disruption":
        warehouse_name = _normalize_location(location)
        disrupted_nodes = [warehouse_name]
        disrupted_route_ids = get_affected_routes_for_port(db, warehouse_name)

    elif disruption_type == "severe_weather":
        # Weather affects a region — disrupt nearby routes (simplified)
        weather_city = _normalize_location(location)
        disrupted_nodes = [weather_city]
        disrupted_route_ids = get_affected_routes_for_port(db, weather_city)

    elif disruption_type in ("strike", "demand_spike", "fuel_price_increase", "vehicle_shortage"):
        # These affect all routes from/to the location
        loc_name = _normalize_location(location)
        disrupted_nodes = [loc_name]
        disrupted_route_ids = get_affected_routes_for_port(db, loc_name)

    # ── Step 2: Find directly affected shipments ──────────────────────────────
    directly_affected = []
    if disrupted_route_ids:
        directly_affected = db.query(Shipment).filter(
            Shipment.route_id.in_(disrupted_route_ids),
            Shipment.status.notin_(["delivered"]),
        ).all()

    if disrupted_nodes:
        port_affected = db.query(Shipment).filter(
            Shipment.port_id.in_(
                [p.port_id for p in db.query(Port).filter(Port.name.ilike(f"%{disrupted_nodes[0]}%")).all()]
            ),
            Shipment.status.notin_(["delivered"]),
        ).all()
        # Deduplicate
        existing_ids = {s.shipment_id for s in directly_affected}
        for s in port_affected:
            if s.shipment_id not in existing_ids:
                directly_affected.append(s)
                existing_ids.add(s.shipment_id)

    logger.info(f"[{sim_id}] Directly affected shipments: {len(directly_affected)}")

    # ── Step 3: Cascading impact ──────────────────────────────────────────────
    # Build graph with disrupted nodes excluded
    clean_graph = build_logistics_graph(db, exclude_nodes=disrupted_nodes)

    # Identify indirectly affected shipments:
    # shipments whose route passes through a disrupted node
    all_active_shipments = db.query(Shipment).filter(
        Shipment.status.notin_(["delivered"])
    ).all()

    direct_ids = {s.shipment_id for s in directly_affected}
    indirectly_affected = []

    for shipment in all_active_shipments:
        if shipment.shipment_id in direct_ids:
            continue
        route = shipment.route
        if not route:
            continue
        # Check if route origin or destination is a disrupted node
        for node in disrupted_nodes:
            if node.lower() in (route.origin.lower(), route.destination.lower()):
                indirectly_affected.append(shipment)
                break

    logger.info(f"[{sim_id}] Indirectly affected shipments: {len(indirectly_affected)}")

    # ── Step 4: Calculate delay and risk per shipment ─────────────────────────
    fleet_summary = get_fleet_summary(db)
    fleet_available_fraction = fleet_summary["available_vehicles"] / max(fleet_summary["total_vehicles"], 1)

    simulation_results = []
    total_cargo_value = 0.0
    total_delay_hours = 0.0
    high_priority_count = 0
    cold_chain_count = 0

    def process_shipment(shipment: Shipment, is_direct: bool):
        nonlocal total_cargo_value, total_delay_hours, high_priority_count, cold_chain_count

        route = shipment.route
        base_delay = _calculate_base_delay(
            duration_hours=duration_hours,
            severity_score=severity_score,
            delay_multiplier=delay_mult,
            capacity_reduction=capacity_reduction,
            disruption_type=disruption_type,
            is_direct=is_direct,
            route_congestion=route.congestion if route else 0.5,
            route_distance=route.distance_km if route else 500.0,
        )

        # Find alternative route
        alt_route = None
        alt_route_id = None
        recovery_cost = 0.0
        if is_direct and route:
            alt_result = find_best_route(clean_graph, route.origin, route.destination)
            if alt_result:
                alt_route = alt_result
                # Recovery cost = extra distance * cost_per_km
                extra_dist = max(0, alt_result["total_distance_km"] - route.distance_km)
                recovery_cost = extra_dist * (route.cost_per_km or 10) * cost_mult
                if alt_result["route_ids"]:
                    alt_route_id = alt_result["route_ids"][0]
                # Alternative route may be faster/slower
                if alt_result["total_time_hours"] > route.normal_time_hours:
                    extra_time = alt_result["total_time_hours"] - route.normal_time_hours
                    base_delay = max(base_delay, extra_time * delay_mult)
            else:
                # No alternative — longer delay
                base_delay *= 1.5
                recovery_cost = shipment.cargo_value * 0.02  # 2% of cargo value

        risk_score, risk_level, cc_risk = calculate_risk_score(
            estimated_delay_hours=base_delay,
            cargo_value=shipment.cargo_value or 0,
            priority=shipment.priority or 3,
            temperature_sensitive=shipment.temperature_sensitive,
            required_temp_min=shipment.required_temp_min,
            required_temp_max=shipment.required_temp_max,
            current_temperature=shipment.current_temperature,
            route_risk=route.risk_score if route else 0.3,
            fleet_available_fraction=fleet_available_fraction,
        )

        total_cargo_value += shipment.cargo_value or 0
        total_delay_hours += base_delay
        if shipment.priority in (1, 2):
            high_priority_count += 1
        if shipment.temperature_sensitive:
            cold_chain_count += 1
            if cc_risk > 0.5:
                cold_chain_count  # already counted above

        result = SimulationResult(
            result_id=str(uuid.uuid4()),
            simulation_id=sim_id,
            shipment_id=shipment.shipment_id,
            is_directly_affected=is_direct,
            is_indirectly_affected=not is_direct,
            estimated_delay_hours=round(base_delay, 2),
            original_route_id=shipment.route_id,
            alternative_route_id=alt_route_id,
            cargo_value=shipment.cargo_value or 0,
            cold_chain_risk=round(cc_risk, 4),
            risk_level=risk_level,
            risk_score=round(risk_score, 4),
            recovery_cost=round(recovery_cost, 2),
        )
        simulation_results.append(result)

    for s in directly_affected:
        process_shipment(s, is_direct=True)
    for s in indirectly_affected:
        process_shipment(s, is_direct=False)

    total_affected = len(directly_affected) + len(indirectly_affected)
    avg_delay = total_delay_hours / max(total_affected, 1)

    # ── Step 5: Risk distribution ─────────────────────────────────────────────
    risk_dist = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for r in simulation_results:
        risk_dist[r.risk_level] = risk_dist.get(r.risk_level, 0) + 1

    # ── Step 6: Available fleet for recovery ──────────────────────────────────
    location_name = _normalize_location(location)
    available_fleet = find_available_fleet(db, location_name, top_n=15)
    cold_chain_fleet = find_available_fleet(db, location_name, require_refrigerated=True, top_n=5)

    avg_cargo_weight = 5000.0
    if directly_affected:
        avg_cargo_weight = sum(s.weight_kg or 5000 for s in directly_affected) / len(directly_affected)

    fleet_req = calculate_fleet_requirements(
        affected_shipment_count=len(directly_affected),
        avg_cargo_weight_kg=avg_cargo_weight,
        cold_chain_count=cold_chain_count,
    )

    # ── Step 7: Generate recovery strategies ─────────────────────────────────
    strategies = _generate_recovery_strategies(
        sim_id=sim_id,
        directly_affected=directly_affected,
        simulation_results=simulation_results,
        duration_hours=duration_hours,
        severity_score=severity_score,
        cost_mult=cost_mult,
        delay_mult=delay_mult,
        available_fleet=available_fleet,
        cold_chain_fleet=cold_chain_fleet,
        fleet_req=fleet_req,
        clean_graph=clean_graph,
        db=db,
    )

    # ── Step 8: Save simulation run ───────────────────────────────────────────
    sim_run = SimulationRun(
        simulation_id=sim_id,
        scenario_name=f"{disruption_type.replace('_', ' ').title()} — {location} ({duration_hours}h)",
        disruption_type=disruption_type,
        location=location,
        duration_hours=duration_hours,
        severity=severity,
        severity_score=severity_score,
        capacity_reduction=capacity_reduction,
        delay_multiplier=delay_mult,
        cost_multiplier=cost_mult,
        temperature_risk_multiplier=temp_risk_mult,
        started_at=started_at,
        completed_at=datetime.utcnow(),
        status="completed",
        total_affected_shipments=total_affected,
        total_cargo_value_exposed=round(total_cargo_value, 2),
        average_delay_hours=round(avg_delay, 2),
        high_priority_affected=high_priority_count,
        cold_chain_at_risk=cold_chain_count,
        recommended_strategy=next((s.strategy_type for s in strategies if s.is_recommended), "balanced"),
    )

    db.add(sim_run)
    db.add_all(simulation_results)
    db.add_all(strategies)
    db.commit()

    logger.info(
        f"[{sim_id}] Simulation complete: {total_affected} affected, "
        f"₹{total_cargo_value:,.0f} exposed, avg delay {avg_delay:.1f}h"
    )

    # ── Step 9: Build response ────────────────────────────────────────────────
    return _build_response(
        sim_run=sim_run,
        simulation_results=simulation_results,
        strategies=strategies,
        risk_dist=risk_dist,
        available_fleet=available_fleet,
        cold_chain_fleet=cold_chain_fleet,
        fleet_req=fleet_req,
        fleet_summary=fleet_summary,
        directly_affected=directly_affected,
        indirectly_affected=indirectly_affected,
        disrupted_route_ids=disrupted_route_ids,
        location=location,
        duration_hours=duration_hours,
        severity=severity,
    )


def _normalize_location(location: str) -> str:
    """Normalize location name for matching against database."""
    mapping = {
        "mumbai port": "Mumbai",
        "mumbai": "Mumbai",
        "jnpt": "JNPT",
        "jawaharlal nehru port": "JNPT",
        "nhava sheva": "JNPT",
        "mundra port": "Mundra",
        "mundra": "Mundra",
        "chennai port": "Chennai",
        "chennai": "Chennai",
        "kolkata port": "Kolkata",
        "kolkata": "Kolkata",
        "kochi port": "Kochi",
        "kochi": "Kochi",
        "visakhapatnam port": "Visakhapatnam",
        "visakhapatnam": "Visakhapatnam",
        "kandla port": "Kandla",
        "kandla": "Kandla",
        "pune": "Pune",
        "ahmedabad": "Ahmedabad",
        "delhi": "Delhi",
        "bengaluru": "Bengaluru",
        "bangalore": "Bengaluru",
        "hyderabad": "Hyderabad",
        "nagpur": "Nagpur",
        "surat": "Surat",
        "jaipur": "Jaipur",
        "lucknow": "Lucknow",
    }
    return mapping.get(location.lower(), location)


def _calculate_base_delay(
    duration_hours: float,
    severity_score: float,
    delay_multiplier: float,
    capacity_reduction: float,
    disruption_type: str,
    is_direct: bool,
    route_congestion: float,
    route_distance: float,
) -> float:
    """
    Calculate estimated delay in hours for a shipment.

    Formula:
        base = disruption_duration * severity * capacity_reduction
        congestion_bonus = route_congestion * base * 0.3
        indirect_discount = 0.4 if not directly affected
        final = (base + congestion_bonus) * delay_multiplier * type_factor * direct_factor
    """
    type_factors = {
        "port_closure": 1.0,
        "route_closure": 0.8,
        "severe_weather": 0.7,
        "strike": 0.9,
        "vehicle_shortage": 0.6,
        "fuel_price_increase": 0.2,  # Affects cost more than delay
        "demand_spike": 0.5,
        "warehouse_disruption": 0.7,
    }
    type_factor = type_factors.get(disruption_type, 0.8)
    direct_factor = 1.0 if is_direct else 0.35

    base = duration_hours * severity_score * capacity_reduction
    congestion_bonus = route_congestion * base * 0.3
    raw_delay = (base + congestion_bonus) * delay_multiplier * type_factor * direct_factor

    return round(max(1.0, raw_delay), 2)


def _generate_recovery_strategies(
    sim_id: str,
    directly_affected: list,
    simulation_results: list,
    duration_hours: float,
    severity_score: float,
    cost_mult: float,
    delay_mult: float,
    available_fleet: list,
    cold_chain_fleet: list,
    fleet_req: dict,
    clean_graph,
    db: Session,
) -> List[RecoveryStrategy]:
    """
    Generate three recovery strategies: cheapest, fastest, balanced (AI-recommended).
    """
    n_affected = len(directly_affected)
    if n_affected == 0:
        return []

    avg_delay = sum(r.estimated_delay_hours for r in simulation_results) / len(simulation_results)
    total_cost = sum(r.recovery_cost for r in simulation_results)
    cold_chain_results = [r for r in simulation_results if r.cold_chain_risk > 0.3]
    avg_cc_risk = sum(r.cold_chain_risk for r in cold_chain_results) / max(len(cold_chain_results), 1)

    # ── Strategy 1: CHEAPEST ──────────────────────────────────────────────────
    # Use slowest available routes, minimal fleet redeployment
    cheapest_delay = avg_delay * 1.25   # Takes longer
    cheapest_cost = total_cost * 0.70   # Saves cost
    cheapest_cc_risk = avg_cc_risk * 1.3  # Higher cold-chain risk (slower)
    cheapest_fleet = max(1, fleet_req["total_vehicles_needed"] // 2)

    cheapest_action_plan = _build_action_plan("cheapest", duration_hours, n_affected, len(cold_chain_fleet))

    s1 = RecoveryStrategy(
        strategy_id=str(uuid.uuid4()),
        simulation_id=sim_id,
        strategy_type="cheapest",
        name="Cost-Optimized Recovery",
        description="Prioritize minimum additional cost. Use cheapest available routes and consolidate shipments where possible. Accept longer delivery times.",
        additional_cost=round(cheapest_cost, 2),
        average_delay_hours=round(cheapest_delay, 2),
        risk_level=score_to_level(0.3 + severity_score * 0.2),
        affected_shipments=n_affected,
        cold_chain_risk_score=round(min(1.0, cheapest_cc_risk), 4),
        fleet_required=cheapest_fleet,
        action_plan_json=json.dumps(cheapest_action_plan),
        is_recommended=False,
    )

    # ── Strategy 2: FASTEST ───────────────────────────────────────────────────
    # Fastest routes, maximum fleet deployment
    fastest_delay = avg_delay * 0.55   # Much faster
    fastest_cost = total_cost * 1.60   # Higher cost
    fastest_cc_risk = avg_cc_risk * 0.6  # Better cold-chain outcome
    fastest_fleet = fleet_req["total_vehicles_needed"]

    fastest_action_plan = _build_action_plan("fastest", duration_hours, n_affected, len(cold_chain_fleet))

    s2 = RecoveryStrategy(
        strategy_id=str(uuid.uuid4()),
        simulation_id=sim_id,
        strategy_type="fastest",
        name="Speed-Optimized Recovery",
        description="Minimize delivery delays at any cost. Deploy maximum available fleet, use fastest routes, and prioritize high-value and cold-chain shipments.",
        additional_cost=round(fastest_cost, 2),
        average_delay_hours=round(fastest_delay, 2),
        risk_level=score_to_level(0.2 + severity_score * 0.1),
        affected_shipments=n_affected,
        cold_chain_risk_score=round(min(1.0, fastest_cc_risk), 4),
        fleet_required=fastest_fleet,
        action_plan_json=json.dumps(fastest_action_plan),
        is_recommended=False,
    )

    # ── Strategy 3: BALANCED (AI RECOMMENDED) ────────────────────────────────
    # Balance cost, delay, risk, cold-chain, fleet
    balanced_delay = avg_delay * 0.80
    balanced_cost = total_cost * 1.15
    balanced_cc_risk = avg_cc_risk * 0.75
    balanced_fleet = max(1, int(fleet_req["total_vehicles_needed"] * 0.75))

    balanced_action_plan = _build_action_plan("balanced", duration_hours, n_affected, len(cold_chain_fleet))

    # Score all three strategies (lower = better)
    # Score = w_cost*norm_cost + w_delay*norm_delay + w_risk*norm_risk + w_cc*cc_risk
    strategies_raw = [
        (cheapest_cost, cheapest_delay, cheapest_cc_risk, 0.3 + severity_score * 0.2),
        (fastest_cost, fastest_delay, fastest_cc_risk, 0.2 + severity_score * 0.1),
        (balanced_cost, balanced_delay, balanced_cc_risk, 0.25 + severity_score * 0.15),
    ]
    max_cost = max(c for c, _, _, _ in strategies_raw) or 1
    max_delay = max(d for _, d, _, _ in strategies_raw) or 1

    scores = []
    for cost, delay, cc, risk in strategies_raw:
        score = (
            0.25 * (cost / max_cost)
            + 0.30 * (delay / max_delay)
            + 0.25 * cc
            + 0.20 * risk
        )
        scores.append(score)

    best_idx = scores.index(min(scores))

    s3 = RecoveryStrategy(
        strategy_id=str(uuid.uuid4()),
        simulation_id=sim_id,
        strategy_type="balanced",
        name="AI-Recommended Balanced Recovery",
        description="Optimal balance of cost, delivery speed, risk mitigation, and cold-chain protection. Prioritizes critical and temperature-sensitive shipments while minimizing unnecessary cost.",
        additional_cost=round(balanced_cost, 2),
        average_delay_hours=round(balanced_delay, 2),
        risk_level=score_to_level(0.25 + severity_score * 0.15),
        affected_shipments=n_affected,
        cold_chain_risk_score=round(min(1.0, balanced_cc_risk), 4),
        fleet_required=balanced_fleet,
        action_plan_json=json.dumps(balanced_action_plan),
        is_recommended=False,
        strategy_score=round(scores[2], 4),
    )

    # Mark the best strategy as recommended
    strategy_list = [s1, s2, s3]
    strategy_list[best_idx].is_recommended = True

    # Store strategy scores
    s1.strategy_score = round(scores[0], 4)
    s2.strategy_score = round(scores[1], 4)
    s3.strategy_score = round(scores[2], 4)

    return strategy_list


def _build_action_plan(
    strategy_type: str,
    duration_hours: float,
    affected_count: int,
    cold_chain_vehicles: int,
) -> list:
    """Build a structured action plan based on strategy type."""
    if strategy_type == "cheapest":
        return [
            {"time": "Immediate", "actions": [
                f"Notify carriers of {affected_count} affected shipments",
                "Activate lowest-cost alternative routes",
                "Consolidate shipments where possible to reduce vehicle requirements",
                "Temporarily hold non-urgent shipments at nearest warehouse",
            ]},
            {"time": "Next 6 hours", "actions": [
                "Coordinate with 3PL providers for consolidated loads",
                "Prioritize high-value cargo for earliest available slots",
                "Update ETAs for all affected customers",
                "Arrange insurance extensions for delayed high-value shipments",
            ]},
            {"time": "Next 24 hours", "actions": [
                f"Monitor disruption status (expected resolution: {duration_hours:.0f} hours)",
                "Re-evaluate if disruption extends beyond expected duration",
                "Begin processing shipments as partial capacity returns",
                "Report cost impact to operations team",
            ]},
        ]
    elif strategy_type == "fastest":
        return [
            {"time": "Immediate", "actions": [
                f"Deploy {cold_chain_vehicles + 3} available vehicles for priority rerouting",
                "Activate express alternative routes (rail + air for critical cargo)",
                f"Prioritize {min(affected_count, 10)} critical and high-priority shipments first",
                "Alert all carriers to stand by for immediate load reassignment",
            ]},
            {"time": "Next 6 hours", "actions": [
                "Complete priority shipment rerouting",
                "Deploy refrigerated vehicles for all cold-chain cargo immediately",
                "Authorize premium freight rates if needed to secure capacity",
                "Issue real-time updates to all affected customers",
            ]},
            {"time": "Next 24 hours", "actions": [
                "Continue processing remaining affected shipments",
                "Monitor alternative route congestion — switch if needed",
                "Full fleet debrief and utilization report",
                "Begin cost reconciliation with carriers",
            ]},
        ]
    else:  # balanced
        return [
            {"time": "Immediate", "actions": [
                f"Triage {affected_count} affected shipments by priority and temperature sensitivity",
                "Activate pre-approved alternative routes for Priority 1 & 2 shipments",
                f"Deploy {cold_chain_vehicles} refrigerated vehicles for cold-chain cargo",
                "Notify top-10 customers by cargo value of expected delays",
            ]},
            {"time": "Next 6 hours", "actions": [
                "Route Priority 3 & 4 shipments via cost-optimized alternatives",
                "Coordinate with carriers for consolidated loads where feasible",
                "Assess and book additional capacity for remaining Priority 1 items",
                "Update demand forecast system with new ETAs",
            ]},
            {"time": "Next 24 hours", "actions": [
                f"Monitor disruption recovery (estimated {duration_hours:.0f} hours)",
                "Rerun simulation if disruption extends or severity changes",
                "Begin gradual transition back to primary routes as capacity restores",
                "Document lessons learned for disruption response playbook",
            ]},
        ]


def _build_response(
    sim_run: SimulationRun,
    simulation_results: list,
    strategies: list,
    risk_dist: dict,
    available_fleet: list,
    cold_chain_fleet: list,
    fleet_req: dict,
    fleet_summary: dict,
    directly_affected: list,
    indirectly_affected: list,
    disrupted_route_ids: list,
    location: str,
    duration_hours: float,
    severity: str,
) -> dict:
    """Build the complete API response dictionary."""

    # Top 20 most at-risk shipments
    top_risks = sorted(simulation_results, key=lambda r: r.risk_score, reverse=True)[:20]
    top_risk_details = []
    for r in top_risks:
        top_risk_details.append({
            "shipment_id": r.shipment_id,
            "risk_score": r.risk_score,
            "risk_level": r.risk_level,
            "delay_hours": r.estimated_delay_hours,
            "cargo_value": r.cargo_value,
            "cold_chain_risk": r.cold_chain_risk,
            "is_direct": r.is_directly_affected,
        })

    # Delay distribution buckets
    delay_buckets = {"0-12h": 0, "12-24h": 0, "24-48h": 0, "48-72h": 0, "72h+": 0}
    for r in simulation_results:
        d = r.estimated_delay_hours
        if d <= 12:
            delay_buckets["0-12h"] += 1
        elif d <= 24:
            delay_buckets["12-24h"] += 1
        elif d <= 48:
            delay_buckets["24-48h"] += 1
        elif d <= 72:
            delay_buckets["48-72h"] += 1
        else:
            delay_buckets["72h+"] += 1

    # Recommended strategy
    recommended = next((s for s in strategies if s.is_recommended), strategies[0] if strategies else None)

    strategies_out = []
    for s in strategies:
        action_plan = []
        try:
            action_plan = json.loads(s.action_plan_json or "[]")
        except Exception:
            pass
        strategies_out.append({
            "strategy_id": s.strategy_id,
            "strategy_type": s.strategy_type,
            "name": s.name,
            "description": s.description,
            "additional_cost_inr": s.additional_cost,
            "average_delay_hours": s.average_delay_hours,
            "risk_level": s.risk_level,
            "affected_shipments": s.affected_shipments,
            "cold_chain_risk_score": s.cold_chain_risk_score,
            "fleet_required": s.fleet_required,
            "is_recommended": s.is_recommended,
            "strategy_score": s.strategy_score,
            "action_plan": action_plan,
        })

    return {
        "simulation_id": sim_run.simulation_id,
        "scenario": {
            "disruption_type": sim_run.disruption_type,
            "location": sim_run.location,
            "duration_hours": sim_run.duration_hours,
            "severity": sim_run.severity,
            "severity_score": sim_run.severity_score,
        },
        "impact_summary": {
            "total_affected_shipments": sim_run.total_affected_shipments,
            "directly_affected": len(directly_affected),
            "indirectly_affected": len(indirectly_affected),
            "total_cargo_value_exposed": sim_run.total_cargo_value_exposed,
            "average_delay_hours": sim_run.average_delay_hours,
            "high_priority_affected": sim_run.high_priority_affected,
            "cold_chain_at_risk": sim_run.cold_chain_at_risk,
            "disrupted_routes": len(disrupted_route_ids),
        },
        "risk_distribution": risk_dist,
        "delay_distribution": delay_buckets,
        "top_risk_shipments": top_risk_details,
        "fleet_summary": fleet_summary,
        "available_fleet": available_fleet[:10],
        "cold_chain_fleet": cold_chain_fleet,
        "fleet_requirements": fleet_req,
        "strategies": strategies_out,
        "recommended_strategy": {
            "strategy_type": recommended.strategy_type if recommended else "balanced",
            "name": recommended.name if recommended else "AI-Recommended Balanced Recovery",
            "additional_cost_inr": recommended.additional_cost if recommended else 0,
            "average_delay_hours": recommended.average_delay_hours if recommended else 0,
            "risk_level": recommended.risk_level if recommended else "medium",
        } if recommended else None,
        "disrupted_route_ids": disrupted_route_ids,
        "completed_at": sim_run.completed_at.isoformat() if sim_run.completed_at else None,
    }
