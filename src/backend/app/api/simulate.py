"""
Simulation API endpoint — ChainMind AI
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models import SimulationRun, SimulationResult, RecoveryStrategy
from app.simulation.engine import run_simulation
from app.llm.explainer import generate_explanation
from app.schemas.api_schemas import SimulationRequest
import json

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/simulate")
async def simulate_disruption(
    request: SimulationRequest,
    db: Session = Depends(get_db),
):
    """
    Run a supply-chain disruption simulation.

    The simulation:
    1. Identifies affected shipments and routes
    2. Calculates cascading delays
    3. Scores risk per shipment
    4. Evaluates fleet availability
    5. Generates three recovery strategies
    6. Scores and recommends the best strategy
    7. Generates LLM-powered explanation (or template fallback)
    """
    # Validate that the location exists in our network
    from app.optimization.route_optimizer import _normalize_location as normalize
    location_normalized = normalize(request.location)

    # Check if we have any routes from/to this location
    from app.database.models import Route
    has_routes = db.query(Route).filter(
        (Route.origin == location_normalized) | (Route.destination == location_normalized)
    ).first()

    if not has_routes:
        # Still proceed — some disruption types affect indirect shipments
        logger.warning(f"No routes found for location: {location_normalized}, proceeding with simulation")

    scenario = request.model_dump(exclude_none=True)
    result = run_simulation(db, scenario)

    if not result:
        raise HTTPException(status_code=500, detail="Simulation failed")

    # Generate LLM explanation
    try:
        explanation = await generate_explanation(result)
        result["explanation"] = explanation
    except Exception as e:
        logger.error(f"Explanation generation failed: {e}")
        result["explanation"] = {"explanation": "Explanation unavailable", "used_llm": False, "llm_provider": "none"}

    return result


@router.get("/simulations/{simulation_id}")
async def get_simulation(simulation_id: str, db: Session = Depends(get_db)):
    """Get a saved simulation run by ID."""
    sim = db.query(SimulationRun).filter(SimulationRun.simulation_id == simulation_id).first()
    if not sim:
        raise HTTPException(status_code=404, detail=f"Simulation {simulation_id} not found")

    results = db.query(SimulationResult).filter(
        SimulationResult.simulation_id == simulation_id
    ).all()
    strategies = db.query(RecoveryStrategy).filter(
        RecoveryStrategy.simulation_id == simulation_id
    ).all()

    strat_list = []
    for s in strategies:
        action_plan = []
        try:
            action_plan = json.loads(s.action_plan_json or "[]")
        except Exception:
            pass
        strat_list.append({
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
        "simulation_id": sim.simulation_id,
        "scenario_name": sim.scenario_name,
        "disruption_type": sim.disruption_type,
        "location": sim.location,
        "duration_hours": sim.duration_hours,
        "severity": sim.severity,
        "status": sim.status,
        "total_affected_shipments": sim.total_affected_shipments,
        "total_cargo_value_exposed": sim.total_cargo_value_exposed,
        "average_delay_hours": sim.average_delay_hours,
        "high_priority_affected": sim.high_priority_affected,
        "cold_chain_at_risk": sim.cold_chain_at_risk,
        "recommended_strategy": sim.recommended_strategy,
        "started_at": sim.started_at.isoformat() if sim.started_at else None,
        "completed_at": sim.completed_at.isoformat() if sim.completed_at else None,
        "result_count": len(results),
        "strategies": strat_list,
    }


@router.get("/simulations")
async def list_simulations(db: Session = Depends(get_db)):
    """List all simulation runs."""
    sims = db.query(SimulationRun).order_by(SimulationRun.created_at.desc()).all()
    return [
        {
            "simulation_id": s.simulation_id,
            "scenario_name": s.scenario_name,
            "disruption_type": s.disruption_type,
            "location": s.location,
            "duration_hours": s.duration_hours,
            "severity": s.severity,
            "total_affected_shipments": s.total_affected_shipments,
            "total_cargo_value_exposed": s.total_cargo_value_exposed,
            "average_delay_hours": s.average_delay_hours,
            "recommended_strategy": s.recommended_strategy,
            "status": s.status,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sims
    ]


@router.get("/recovery-strategies/{simulation_id}")
async def get_recovery_strategies(simulation_id: str, db: Session = Depends(get_db)):
    """Get recovery strategies for a simulation."""
    strategies = db.query(RecoveryStrategy).filter(
        RecoveryStrategy.simulation_id == simulation_id
    ).all()
    if not strategies:
        raise HTTPException(status_code=404, detail=f"No strategies found for simulation {simulation_id}")

    result = []
    for s in strategies:
        action_plan = []
        try:
            action_plan = json.loads(s.action_plan_json or "[]")
        except Exception:
            pass
        result.append({
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
            "explanation": s.explanation,
        })
    return result


@router.get("/impact/{simulation_id}")
async def get_simulation_impact(simulation_id: str, db: Session = Depends(get_db)):
    """Get detailed impact (shipment-level) for a simulation."""
    results = db.query(SimulationResult).filter(
        SimulationResult.simulation_id == simulation_id
    ).order_by(SimulationResult.risk_score.desc()).all()

    if not results:
        raise HTTPException(status_code=404, detail=f"No impact data for simulation {simulation_id}")

    return [
        {
            "result_id": r.result_id,
            "shipment_id": r.shipment_id,
            "is_directly_affected": r.is_directly_affected,
            "is_indirectly_affected": r.is_indirectly_affected,
            "estimated_delay_hours": r.estimated_delay_hours,
            "cargo_value": r.cargo_value,
            "cold_chain_risk": r.cold_chain_risk,
            "risk_level": r.risk_level,
            "risk_score": r.risk_score,
            "recovery_cost": r.recovery_cost,
            "original_route_id": r.original_route_id,
            "alternative_route_id": r.alternative_route_id,
        }
        for r in results
    ]


@router.get("/cold-chain/{simulation_id}")
async def get_cold_chain_impact(simulation_id: str, db: Session = Depends(get_db)):
    """Get cold-chain specific impact for a simulation."""
    from app.database.models import Shipment

    results = db.query(SimulationResult).filter(
        SimulationResult.simulation_id == simulation_id,
        SimulationResult.cold_chain_risk > 0.0,
    ).order_by(SimulationResult.cold_chain_risk.desc()).all()

    cold_chain_data = []
    for r in results:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == r.shipment_id).first()
        if shipment and shipment.temperature_sensitive:
            cold_chain_data.append({
                "shipment_id": r.shipment_id,
                "cargo_type": shipment.cargo_type,
                "cargo_value": shipment.cargo_value,
                "required_temp_min": shipment.required_temp_min,
                "required_temp_max": shipment.required_temp_max,
                "current_temperature": shipment.current_temperature,
                "estimated_delay_hours": r.estimated_delay_hours,
                "cold_chain_risk": r.cold_chain_risk,
                "risk_level": r.risk_level,
                "priority": shipment.priority,
            })

    return {
        "simulation_id": simulation_id,
        "total_cold_chain_affected": len(cold_chain_data),
        "shipments": cold_chain_data,
    }
