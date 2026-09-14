"""
Scenarios and What-If Comparison API — ChainMind AI
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.session import get_db
from app.simulation.engine import run_simulation
from app.llm.explainer import generate_explanation
from app.schemas.api_schemas import SimulationRequest

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/what-if")
async def what_if_comparison(
    scenarios: List[SimulationRequest],
    db: Session = Depends(get_db),
):
    """
    Run multiple scenarios and compare results.
    Maximum 5 scenarios per request.
    """
    if len(scenarios) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 scenarios to compare")
    if len(scenarios) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 scenarios per what-if comparison")

    results = []
    for i, scenario_req in enumerate(scenarios):
        logger.info(f"Running what-if scenario {i+1}/{len(scenarios)}")
        scenario_data = scenario_req.model_dump(exclude_none=True)
        sim_result = run_simulation(db, scenario_data)
        if sim_result:
            # Add lightweight explanation for each
            try:
                explanation = await generate_explanation(sim_result)
                sim_result["explanation"] = explanation
            except Exception:
                pass
            results.append(sim_result)

    if not results:
        raise HTTPException(status_code=500, detail="All scenarios failed")

    # Build comparison matrix
    comparison = _build_comparison(results)

    return {
        "scenarios": results,
        "comparison": comparison,
    }


def _build_comparison(results: list) -> dict:
    """Build a comparison matrix across scenarios."""
    if not results:
        return {}

    fields = [
        ("total_affected_shipments", "impact_summary"),
        ("total_cargo_value_exposed", "impact_summary"),
        ("average_delay_hours", "impact_summary"),
        ("high_priority_affected", "impact_summary"),
        ("cold_chain_at_risk", "impact_summary"),
    ]

    comparison = {
        "scenario_ids": [r["simulation_id"] for r in results],
        "scenario_labels": [
            f"{r['scenario']['disruption_type'].replace('_', ' ').title()} — {r['scenario']['location']} {r['scenario']['duration_hours']}h"
            for r in results
        ],
        "metrics": {},
        "recommended_strategies": [],
    }

    for field, section in fields:
        comparison["metrics"][field] = [
            r.get(section, {}).get(field, 0) for r in results
        ]

    for r in results:
        rec = r.get("recommended_strategy", {})
        comparison["recommended_strategies"].append({
            "simulation_id": r["simulation_id"],
            "strategy_type": rec.get("strategy_type") if rec else None,
            "name": rec.get("name") if rec else None,
            "additional_cost_inr": rec.get("additional_cost_inr") if rec else None,
            "average_delay_hours": rec.get("average_delay_hours") if rec else None,
            "risk_level": rec.get("risk_level") if rec else None,
        })

    # Find worst scenario
    delays = comparison["metrics"]["average_delay_hours"]
    worst_idx = delays.index(max(delays)) if delays else 0
    best_idx = delays.index(min(delays)) if delays else 0

    comparison["worst_scenario_idx"] = worst_idx
    comparison["best_scenario_idx"] = best_idx
    comparison["delay_increase_pct"] = (
        round((max(delays) - min(delays)) / max(min(delays), 1) * 100, 1)
        if delays else 0
    )

    return comparison
