"""
Auto Mode API — ChainMind AI Round 2

Endpoints:
  POST /api/auto/start
  POST /api/auto/pause
  POST /api/auto/resume
  POST /api/auto/stop
  GET  /api/auto/status
  GET  /api/auto/history
  GET  /api/auto/runs
  GET  /api/auto/runs/{run_id}
  GET  /api/auto/scenarios
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.simulation.auto_mode_controller import get_auto_controller
from app.simulation.condition_generator import SCENARIOS, LOCATION_BASELINES

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request / Response Models ─────────────────────────────────────────────────

class AutoStartRequest(BaseModel):
    location: str = Field(default="Mumbai", description="Location/city to monitor")
    scenario: str = Field(default="monsoon_buildup", description="Condition escalation scenario")
    cycle_interval_seconds: int = Field(
        default=30, ge=5, le=3600,
        description="Seconds between autonomous cycles"
    )
    max_cycles: Optional[int] = Field(
        default=None, ge=1,
        description="Maximum cycles before auto-stop. None = unlimited."
    )

    @field_validator("location")
    @classmethod
    def validate_location(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("location must not be empty")
        return v.strip()

    @field_validator("scenario")
    @classmethod
    def validate_scenario(cls, v: str) -> str:
        if v not in SCENARIOS:
            raise ValueError(f"Unknown scenario '{v}'. Valid: {list(SCENARIOS.keys())}")
        return v


class AutoStatusResponse(BaseModel):
    run_id: Optional[str]
    status: str          # idle / running / paused
    phase: str           # idle / monitoring / condition_change / detection / ...
    location: str
    scenario: str
    cycle_interval_seconds: int
    max_cycles: Optional[int]
    total_cycles: int
    crises_detected: int
    started_at: Optional[str]
    paused_at: Optional[str]
    current_conditions: Optional[Dict[str, Any]]
    last_outcome: Optional[Dict[str, Any]]
    last_error: Optional[str]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/auto/start", response_model=AutoStatusResponse, tags=["Auto Mode"])
async def start_auto_mode(body: AutoStartRequest):
    """
    Start autonomous monitoring.

    The controller will:
    1. Generate bounded condition changes each cycle.
    2. Run the causal engine to detect threshold violations.
    3. If a crisis is detected, run the full simulation/recovery pipeline.
    4. Persist results and events.
    """
    controller = get_auto_controller()
    try:
        status = await controller.start(
            location=body.location,
            scenario=body.scenario,
            cycle_interval_seconds=body.cycle_interval_seconds,
            max_cycles=body.max_cycles,
        )
        return status
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.exception(f"Failed to start auto mode: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auto/pause", response_model=AutoStatusResponse, tags=["Auto Mode"])
async def pause_auto_mode():
    """Pause autonomous monitoring between cycles."""
    controller = get_auto_controller()
    try:
        return await controller.pause()
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/auto/resume", response_model=AutoStatusResponse, tags=["Auto Mode"])
async def resume_auto_mode():
    """Resume paused autonomous monitoring."""
    controller = get_auto_controller()
    try:
        return await controller.resume()
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/auto/stop", response_model=AutoStatusResponse, tags=["Auto Mode"])
async def stop_auto_mode():
    """Stop autonomous monitoring."""
    controller = get_auto_controller()
    return await controller.stop()


@router.get("/auto/status", response_model=AutoStatusResponse, tags=["Auto Mode"])
async def get_auto_status():
    """Get current Auto Mode controller status."""
    controller = get_auto_controller()
    return controller.status()


@router.get("/auto/history", tags=["Auto Mode"])
async def get_auto_history(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Return recent Auto Mode simulation runs (mode='auto').
    Sorted newest-first.
    """
    from app.database.models import SimulationRun
    runs = (
        db.query(SimulationRun)
        .filter(SimulationRun.mode == "auto")
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
            "severity": r.severity,
            "total_affected_shipments": r.total_affected_shipments,
            "average_delay_hours": r.average_delay_hours,
            "recommended_strategy": r.recommended_strategy,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return {"runs": result, "total": len(result)}


@router.get("/auto/runs", tags=["Auto Mode"])
async def list_auto_mode_runs(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List AutoModeRun records (each is a start→stop session)."""
    from app.database.models import AutoModeRun
    runs = (
        db.query(AutoModeRun)
        .order_by(AutoModeRun.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for r in runs:
        outcome = None
        if r.last_outcome_json:
            try:
                outcome = json.loads(r.last_outcome_json)
            except Exception:
                pass
        result.append({
            "run_id": r.run_id,
            "status": r.status,
            "phase": r.phase,
            "monitored_location": r.monitored_location,
            "cycle_interval_seconds": r.cycle_interval_seconds,
            "max_cycles": r.max_cycles,
            "total_cycles": r.total_cycles,
            "total_crises_detected": r.total_crises_detected,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "stopped_at": r.stopped_at.isoformat() if r.stopped_at else None,
            "last_cycle_at": r.last_cycle_at.isoformat() if r.last_cycle_at else None,
            "last_outcome": outcome,
            "last_error": r.last_error,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return {"runs": result, "total": len(result)}


@router.get("/auto/runs/{run_id}", tags=["Auto Mode"])
async def get_auto_mode_run(run_id: str, db: Session = Depends(get_db)):
    """Get a specific AutoModeRun session by ID, including its events."""
    from app.database.models import AutoModeRun, SimulationEvent
    run = db.query(AutoModeRun).filter(AutoModeRun.run_id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail=f"AutoModeRun '{run_id}' not found")

    # Load events associated with this run_id
    events = (
        db.query(SimulationEvent)
        .filter(SimulationEvent.simulation_id == run_id)
        .order_by(SimulationEvent.sequence, SimulationEvent.timestamp)
        .all()
    )
    event_list = []
    for e in events:
        payload = None
        if e.payload_json:
            try:
                payload = json.loads(e.payload_json)
            except Exception:
                pass
        event_list.append({
            "event_id": e.event_id,
            "sequence": e.sequence,
            "stage": e.stage,
            "event_type": e.event_type,
            "severity": e.severity,
            "affected_entity": e.affected_entity,
            "summary": e.summary,
            "payload": payload,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        })

    outcome = None
    if run.last_outcome_json:
        try:
            outcome = json.loads(run.last_outcome_json)
        except Exception:
            pass
    cond = None
    if run.current_conditions_json:
        try:
            cond = json.loads(run.current_conditions_json)
        except Exception:
            pass

    return {
        "run_id": run.run_id,
        "status": run.status,
        "phase": run.phase,
        "monitored_location": run.monitored_location,
        "cycle_interval_seconds": run.cycle_interval_seconds,
        "max_cycles": run.max_cycles,
        "total_cycles": run.total_cycles,
        "total_crises_detected": run.total_crises_detected,
        "current_simulation_id": run.current_simulation_id,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "paused_at": run.paused_at.isoformat() if run.paused_at else None,
        "stopped_at": run.stopped_at.isoformat() if run.stopped_at else None,
        "last_cycle_at": run.last_cycle_at.isoformat() if run.last_cycle_at else None,
        "current_conditions": cond,
        "last_outcome": outcome,
        "last_error": run.last_error,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "events": event_list,
    }


@router.get("/auto/scenarios", tags=["Auto Mode"])
async def list_auto_scenarios():
    """List available Auto Mode condition scenarios."""
    return {
        "scenarios": [
            {
                "name": name,
                "description": data["description"],
                "steps": len(data["steps"]),
            }
            for name, data in SCENARIOS.items()
        ],
        "locations": list(LOCATION_BASELINES.keys()),
    }
