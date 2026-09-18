"""
Auto Mode Controller — ChainMind AI Round 2

Manages the autonomous monitoring lifecycle:
  IDLE → MONITORING → CONDITION_CHANGE → DETECTION → ANALYSIS
       → SIMULATION → RECOVERY → EXPLANATION → RECORDING → MONITORING

Design principles:
- Single global instance shared across the FastAPI process
- asyncio-based background task (no threads)
- All numerical truth comes from the existing simulation/causal pipeline
- LLM is explanation-only
- State is persisted to AutoModeRun in the DB for recovery across restarts
- Bounded condition evolution via ConditionGenerator (not random)
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Lazy DB imports (avoid circular imports at module load) ────────────────────

def _get_db():
    from app.database.session import SessionLocal
    return SessionLocal()


def _get_manual_sim():
    from app.simulation.manual_mode import run_manual_simulation
    return run_manual_simulation


def _get_causal_engine():
    from app.simulation.causal_engine import run_causal_engine
    return run_causal_engine


# ── Controller ────────────────────────────────────────────────────────────────

class AutoModeController:
    """
    Singleton autonomous monitoring controller.

    Usage:
        controller = get_auto_controller()
        await controller.start(location="Mumbai", scenario="monsoon_buildup")
        await controller.pause()
        await controller.resume()
        await controller.stop()
    """

    def __init__(self):
        self._run_id: Optional[str] = None
        self._task: Optional[asyncio.Task] = None
        # Explicit running flag — not derived from _task.done() so that
        # immediate task failure (e.g. event-loop mismatch in tests) does not
        # silently allow a second start() to succeed.
        self._running: bool = False
        # Events are created lazily in start() to bind to the current event loop
        self._stop_event: asyncio.Event = asyncio.Event()
        self._pause_event: asyncio.Event = asyncio.Event()
        self._pause_event.set()  # start unpaused

        # Runtime state (authoritative in-memory; also persisted to DB)
        self._phase: str = "idle"
        self._location: str = "Mumbai"
        self._scenario: str = "normal_fluctuation"
        self._cycle_interval: int = 30
        self._max_cycles: Optional[int] = None
        self._total_cycles: int = 0
        self._crises_detected: int = 0
        self._last_outcome: Optional[Dict[str, Any]] = None
        self._last_error: Optional[str] = None
        self._started_at: Optional[datetime] = None
        self._paused_at: Optional[datetime] = None

        # Condition generator (set on start)
        self._cond_gen = None

        logger.info("AutoModeController initialized")

    # ── Public API ─────────────────────────────────────────────────────────────

    async def start(
        self,
        location: str = "Mumbai",
        scenario: str = "monsoon_buildup",
        cycle_interval_seconds: int = 30,
        max_cycles: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Start autonomous monitoring. Raises if already running."""
        if self._running:
            raise ValueError("Auto Mode is already running. Use /api/auto/stop first.")

        from app.simulation.condition_generator import ConditionGenerator
        self._run_id = str(uuid.uuid4())
        self._location = location
        self._scenario = scenario
        self._cycle_interval = max(5, cycle_interval_seconds)
        self._max_cycles = max_cycles
        self._total_cycles = 0
        self._crises_detected = 0
        self._last_outcome = None
        self._last_error = None
        self._started_at = datetime.utcnow()
        self._paused_at = None
        self._cond_gen = ConditionGenerator(location=location, initial_scenario=scenario)
        # Re-create events bound to the current event loop (required when
        # the controller is reused across different event loops in tests or
        # after server restart with a new loop).
        self._stop_event = asyncio.Event()
        self._pause_event = asyncio.Event()
        self._pause_event.set()

        # Persist initial AutoModeRun record
        self._persist_run_state("monitoring")

        # Record monitoring_started event
        self._record_lifecycle_event("monitoring_started", f"Auto Mode started: {location}/{scenario}")

        # Launch background loop
        self._running = True
        self._task = asyncio.create_task(self._monitoring_loop(), name=f"automode-{self._run_id[:8]}")
        logger.info(f"Auto Mode started — run_id={self._run_id} location={location} scenario={scenario}")

        return self.status()

    async def pause(self) -> Dict[str, Any]:
        """Pause between cycles (current cycle finishes first)."""
        if not self._running:
            raise ValueError("Auto Mode is not running.")
        if not self._pause_event.is_set():
            raise ValueError("Auto Mode is already paused.")
        self._pause_event.clear()
        self._paused_at = datetime.utcnow()
        self._persist_run_state("paused")
        self._record_lifecycle_event("auto_paused", "Auto Mode paused by operator")
        logger.info(f"Auto Mode paused — run_id={self._run_id}")
        return self.status()

    async def resume(self) -> Dict[str, Any]:
        """Resume after a pause."""
        if not self._running:
            raise ValueError("Auto Mode is not running.")
        if self._pause_event.is_set():
            raise ValueError("Auto Mode is not paused.")
        self._pause_event.set()
        self._paused_at = None
        self._persist_run_state("monitoring")
        self._record_lifecycle_event("monitoring_resumed", "Auto Mode resumed by operator")
        logger.info(f"Auto Mode resumed — run_id={self._run_id}")
        return self.status()

    async def stop(self) -> Dict[str, Any]:
        """Stop autonomous monitoring cleanly."""
        if not self._running:
            # Already stopped — return idle status
            return self.status()
        self._running = False
        self._stop_event.set()
        self._pause_event.set()  # unblock if paused
        try:
            await asyncio.wait_for(asyncio.shield(self._task), timeout=10.0)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            self._task.cancel()
        self._persist_run_state("stopped")
        self._record_lifecycle_event("auto_stopped", "Auto Mode stopped by operator")
        logger.info(f"Auto Mode stopped — run_id={self._run_id}")
        return self.status()

    def status(self) -> Dict[str, Any]:
        """Return current controller status dict."""
        running = self._running
        paused = running and not self._pause_event.is_set()
        phase = self._phase if running else "idle"

        return {
            "run_id": self._run_id,
            "status": "paused" if paused else ("running" if running else "idle"),
            "phase": phase,
            "location": self._location,
            "scenario": self._scenario,
            "cycle_interval_seconds": self._cycle_interval,
            "max_cycles": self._max_cycles,
            "total_cycles": self._total_cycles,
            "crises_detected": self._crises_detected,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "paused_at": self._paused_at.isoformat() if self._paused_at else None,
            "current_conditions": self._cond_gen.current() if self._cond_gen else None,
            "last_outcome": self._last_outcome,
            "last_error": self._last_error,
        }

    # ── Monitoring Loop ────────────────────────────────────────────────────────

    async def _monitoring_loop(self):
        """Main autonomous loop — runs until stopped or max_cycles reached."""
        logger.info(f"Monitoring loop started — run_id={self._run_id}")
        try:
            while not self._stop_event.is_set():
                # Respect pause
                await self._pause_event.wait()
                if self._stop_event.is_set():
                    break

                # Check cycle limit
                if self._max_cycles is not None and self._total_cycles >= self._max_cycles:
                    logger.info(f"Max cycles ({self._max_cycles}) reached — stopping")
                    self._persist_run_state("stopped")
                    break

                # Run one cycle
                await self._run_cycle()

                # Wait for next cycle (interruptible)
                try:
                    await asyncio.wait_for(
                        self._stop_event.wait(),
                        timeout=self._cycle_interval,
                    )
                except asyncio.TimeoutError:
                    pass  # Normal — interval elapsed

        except asyncio.CancelledError:
            logger.info(f"Monitoring loop cancelled — run_id={self._run_id}")
        except Exception as exc:
            logger.exception(f"Monitoring loop fatal error — run_id={self._run_id}: {exc}")
            self._last_error = str(exc)
            self._persist_run_state("error")
        finally:
            self._phase = "idle"
            self._running = False
            logger.info(f"Monitoring loop exited — run_id={self._run_id}")

    async def _run_cycle(self):
        """Execute one autonomous monitoring cycle."""
        cycle_num = self._total_cycles + 1
        cycle_sim_id: Optional[str] = None
        crisis_detected = False

        try:
            # ── Phase: condition_change ──────────────────────────────────────
            self._phase = "condition_change"
            self._persist_run_state("monitoring")
            conditions = await asyncio.get_event_loop().run_in_executor(
                None, self._cond_gen.advance
            )
            logger.debug(f"Cycle {cycle_num}: conditions advanced at {self._location}")

            # ── Phase: detection (causal engine) ────────────────────────────
            self._phase = "detection"
            run_causal = _get_causal_engine()
            causal_result = await asyncio.get_event_loop().run_in_executor(
                None, lambda: run_causal([conditions], [])
            )

            has_disruptions = bool(causal_result.generated_disruptions)

            # ── Phase: analysis ──────────────────────────────────────────────
            self._phase = "analysis"

            if not has_disruptions:
                # No crisis this cycle — record a quiet cycle event
                self._record_cycle_event(
                    cycle_num, "cycle_completed",
                    f"Cycle {cycle_num}: No threshold violations at {self._location}",
                    {"conditions": conditions, "crisis": False},
                    severity="info",
                )
                self._total_cycles += 1
                self._phase = "monitoring"
                self._persist_run_state("monitoring")
                return

            # ── Phase: simulation ────────────────────────────────────────────
            self._phase = "simulation"
            crisis_detected = True
            self._crises_detected += 1

            run_manual = _get_manual_sim()
            sim_result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._run_simulation_sync(
                    run_manual, conditions, causal_result, cycle_num
                ),
            )
            cycle_sim_id = sim_result.get("simulation_id")

            # ── Phase: recovery ──────────────────────────────────────────────
            self._phase = "recovery"
            strategies = sim_result.get("strategies", [])
            rec = sim_result.get("recommended_strategy", {})

            # ── Phase: explanation ───────────────────────────────────────────
            self._phase = "explanation"
            # Explanation is generated inside run_simulation already

            # ── Phase: recording ─────────────────────────────────────────────
            self._phase = "recording"
            outcome = {
                "cycle": cycle_num,
                "simulation_id": cycle_sim_id,
                "location": self._location,
                "conditions": conditions,
                "crises_detected": len(causal_result.generated_disruptions),
                "disruption_types": [d.disruption_type for d in causal_result.generated_disruptions],
                "affected_shipments": sim_result.get("impact_summary", {}).get("total_affected_shipments", 0),
                "recommended_strategy": rec.get("name") if rec else None,
                "strategy_count": len(strategies),
                "timestamp": datetime.utcnow().isoformat(),
            }
            self._last_outcome = outcome
            self._update_auto_run_latest(cycle_sim_id, outcome)

            self._record_cycle_event(
                cycle_num, "cycle_completed",
                f"Cycle {cycle_num}: Crisis detected at {self._location} — "
                f"{len(causal_result.generated_disruptions)} disruption(s), "
                f"{outcome['affected_shipments']} shipments affected",
                outcome,
                severity="high" if outcome["affected_shipments"] > 10 else "medium",
            )

        except Exception as exc:
            logger.exception(f"Cycle {cycle_num} failed: {exc}")
            self._last_error = str(exc)
            self._record_cycle_event(
                cycle_num, "cycle_failed",
                f"Cycle {cycle_num} error: {exc}",
                {"error": str(exc)},
                severity="high",
            )

        finally:
            self._total_cycles += 1
            self._phase = "monitoring"

    def _run_simulation_sync(self, run_manual, conditions, causal_result, cycle_num):
        """Run manual simulation synchronously (called via executor)."""
        run_label = (
            f"Auto Cycle {cycle_num} — {self._location} "
            f"[{datetime.utcnow().strftime('%H:%M:%S')}]"
        )
        db = _get_db()
        try:
            result = run_manual(
                db=db,
                conditions=[conditions],
                direct_disruptions=[],
                interrupt_connection_ids=[],
                run_label=run_label,
            )
            # Tag as auto mode
            from app.database.models import SimulationRun
            sim_id = result.get("simulation_id")
            if sim_id:
                sim_run = db.query(SimulationRun).filter(
                    SimulationRun.simulation_id == sim_id
                ).first()
                if sim_run:
                    sim_run.mode = "auto"
                    sim_run.run_label = run_label
                    db.add(sim_run)
                    db.commit()
            return result
        finally:
            db.close()

    # ── DB Helpers ─────────────────────────────────────────────────────────────

    def _persist_run_state(self, status: str):
        """Upsert the AutoModeRun record in the DB."""
        if not self._run_id:
            return
        db = _get_db()
        try:
            from app.database.models import AutoModeRun
            run = db.query(AutoModeRun).filter(AutoModeRun.run_id == self._run_id).first()
            if not run:
                run = AutoModeRun(run_id=self._run_id)
                db.add(run)
            run.status = status
            run.phase = self._phase
            run.monitored_location = self._location
            run.cycle_interval_seconds = self._cycle_interval
            run.max_cycles = self._max_cycles
            run.total_cycles = self._total_cycles
            run.total_crises_detected = self._crises_detected
            run.started_at = self._started_at
            run.paused_at = self._paused_at
            if status == "stopped":
                run.stopped_at = datetime.utcnow()
            if self._cond_gen:
                run.current_conditions_json = json.dumps(self._cond_gen.snapshot_for_db())
            if self._last_outcome:
                run.last_outcome_json = json.dumps(self._last_outcome)
            if self._last_error:
                run.last_error = self._last_error
            run.updated_at = datetime.utcnow()
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to persist AutoModeRun state: {e}")
        finally:
            db.close()

    def _update_auto_run_latest(self, sim_id: Optional[str], outcome: Dict[str, Any]):
        """Update the latest cycle outcome on the AutoModeRun record."""
        if not self._run_id:
            return
        db = _get_db()
        try:
            from app.database.models import AutoModeRun
            run = db.query(AutoModeRun).filter(AutoModeRun.run_id == self._run_id).first()
            if run:
                run.current_simulation_id = sim_id
                run.total_cycles = self._total_cycles + 1
                run.total_crises_detected = self._crises_detected
                run.last_cycle_at = datetime.utcnow()
                run.last_outcome_json = json.dumps(outcome)
                run.updated_at = datetime.utcnow()
                db.commit()
        except Exception as e:
            logger.warning(f"Failed to update AutoModeRun latest: {e}")
        finally:
            db.close()

    def _record_lifecycle_event(self, stage: str, summary: str):
        """Record a lifecycle SimulationEvent (not tied to a simulation run)."""
        if not self._run_id:
            return
        db = _get_db()
        try:
            from app.database.models import SimulationEvent
            event = SimulationEvent(
                event_id=str(uuid.uuid4()),
                simulation_id=self._run_id,  # use run_id as grouping key
                sequence=0,
                stage=stage,
                event_type=stage,
                severity="info",
                affected_entity="auto_mode_controller",
                affected_scope="system",
                causal_source="auto_mode",
                summary=summary,
                payload_json=json.dumps({"run_id": self._run_id, "location": self._location}),
                timestamp=datetime.utcnow(),
            )
            db.add(event)
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to record lifecycle event: {e}")
        finally:
            db.close()

    def _record_cycle_event(
        self,
        cycle_num: int,
        stage: str,
        summary: str,
        payload: Dict[str, Any],
        severity: str = "info",
    ):
        """Record a per-cycle SimulationEvent."""
        if not self._run_id:
            return
        db = _get_db()
        try:
            from app.database.models import SimulationEvent
            event = SimulationEvent(
                event_id=str(uuid.uuid4()),
                simulation_id=self._run_id,
                sequence=cycle_num,
                stage=stage,
                event_type=stage,
                severity=severity,
                affected_entity=self._location,
                affected_scope="region",
                causal_source="auto_mode",
                summary=summary,
                payload_json=json.dumps(payload),
                timestamp=datetime.utcnow(),
            )
            db.add(event)
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to record cycle event: {e}")
        finally:
            db.close()


# ── Singleton ─────────────────────────────────────────────────────────────────

_auto_controller: Optional[AutoModeController] = None


def get_auto_controller() -> AutoModeController:
    """Return the global AutoModeController singleton."""
    global _auto_controller
    if _auto_controller is None:
        _auto_controller = AutoModeController()
    return _auto_controller
