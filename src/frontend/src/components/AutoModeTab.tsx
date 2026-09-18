import { useState, useEffect, useCallback, useRef } from 'react';
import {
  startAutoMode,
  pauseAutoMode,
  resumeAutoMode,
  stopAutoMode,
  getAutoStatus,
  getAutoRuns,
  getAutoScenarios,
  type AutoStatusResponse,
  type AutoModeRunSummary,
  type AutoScenario,
} from '../services/api';

// ── Phase display helpers ──────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  idle:             'Idle',
  monitoring:       'Monitoring',
  condition_change: 'Condition Change',
  detection:        'Detection',
  analysis:         'Analysis',
  simulation:       'Simulation',
  recovery:         'Recovery',
  explanation:      'Explanation',
  recording:        'Recording',
};

const PHASE_COLORS: Record<string, string> = {
  idle:             'text-slate-400',
  monitoring:       'text-green-400',
  condition_change: 'text-yellow-400',
  detection:        'text-orange-400',
  analysis:         'text-orange-400',
  simulation:       'text-blue-400',
  recovery:         'text-purple-400',
  explanation:      'text-blue-300',
  recording:        'text-teal-400',
};

const STATUS_BADGE: Record<string, string> = {
  idle:    'bg-slate-700 text-slate-300',
  running: 'bg-green-900/60 text-green-300 border border-green-700',
  paused:  'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
};

function formatConditions(conds: Record<string, unknown> | null): string {
  if (!conds) return '—';
  const keys = ['rainfall_mm', 'temperature_c', 'traffic_level', 'road_condition', 'port_congestion', 'weather_severity'];
  return keys
    .filter(k => conds[k] !== undefined)
    .map(k => {
      const v = conds[k] as number;
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const val = Number.isInteger(v) ? v.toString() : v.toFixed(2);
      return `${label}: ${val}`;
    })
    .join('  •  ');
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AutoModeTab() {
  // Configuration
  const [location, setLocation] = useState('Mumbai');
  const [scenario, setScenario] = useState('monsoon_buildup');
  const [intervalSecs, setIntervalSecs] = useState(30);
  const [maxCycles, setMaxCycles] = useState<number | ''>('');

  // Remote state
  const [status, setStatus] = useState<AutoStatusResponse | null>(null);
  const [runs, setRuns] = useState<AutoModeRunSummary[]>([]);
  const [scenarios, setScenarios] = useState<AutoScenario[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load scenarios/locations once ─────────────────────────────────────────
  useEffect(() => {
    getAutoScenarios()
      .then(data => {
        setScenarios(data.scenarios);
        setLocations(data.locations);
      })
      .catch(() => {/* non-fatal */});
  }, []);

  // ── Poll status while running ──────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const s = await getAutoStatus();
      setStatus(s);
    } catch {
      // silently ignore polling errors
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const data = await getAutoRuns(20);
      setRuns(data.runs);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchRuns();
  }, [fetchStatus, fetchRuns]);

  useEffect(() => {
    const isActive = status?.status === 'running' || status?.status === 'paused';
    if (isActive && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        fetchStatus();
      }, 3000);
    } else if (!isActive && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
      // Refresh run list when stopping
      fetchRuns();
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [status?.status, fetchStatus, fetchRuns]);

  // ── Action handlers ────────────────────────────────────────────────────────
  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await startAutoMode({
        location,
        scenario,
        cycle_interval_seconds: intervalSecs,
        max_cycles: maxCycles === '' ? null : Number(maxCycles),
      });
      setStatus(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start Auto Mode');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await pauseAutoMode();
      setStatus(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to pause');
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await resumeAutoMode();
      setStatus(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to resume');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await stopAutoMode();
      setStatus(s);
      fetchRuns();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to stop Auto Mode');
    } finally {
      setLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const isIdle    = !status || status.status === 'idle';
  const isRunning = status?.status === 'running';
  const isPaused  = status?.status === 'paused';
  const isActive  = isRunning || isPaused;
  const phase     = status?.phase ?? 'idle';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Auto Mode</h2>
          <p className="text-slate-400 text-sm mt-1">
            Autonomous supply-chain monitoring with causal crisis detection
          </p>
        </div>
        {status && (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${STATUS_BADGE[status.status] ?? STATUS_BADGE['idle']}`}>
            {status.status}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left: Configuration + Controls ─────────────────────────────── */}
        <div className="space-y-4">

          {/* Configuration card */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-white">Configuration</h3>
            </div>
            <div className="card-body space-y-4">

              <div>
                <label className="label">Monitored Location</label>
                <select
                  className="select-field"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  disabled={isActive}
                >
                  {locations.length > 0
                    ? locations.map(l => <option key={l} value={l}>{l}</option>)
                    : ['Mumbai', 'Chennai', 'Delhi', 'Kolkata', 'Bengaluru', 'Ahmedabad', 'Hyderabad']
                        .map(l => <option key={l} value={l}>{l}</option>)
                  }
                </select>
              </div>

              <div>
                <label className="label">Condition Scenario</label>
                <select
                  className="select-field"
                  value={scenario}
                  onChange={e => setScenario(e.target.value)}
                  disabled={isActive}
                >
                  {scenarios.length > 0
                    ? scenarios.map(s => (
                        <option key={s.name} value={s.name}>
                          {s.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} — {s.description}
                        </option>
                      ))
                    : (
                      <>
                        <option value="monsoon_buildup">Monsoon Buildup</option>
                        <option value="heatwave">Heatwave</option>
                        <option value="port_congestion_spike">Port Congestion Spike</option>
                        <option value="road_degradation">Road Degradation</option>
                        <option value="normal_fluctuation">Normal Fluctuation</option>
                      </>
                    )
                  }
                </select>
                {scenarios.find(s => s.name === scenario) && (
                  <p className="text-xs text-slate-500 mt-1">
                    {scenarios.find(s => s.name === scenario)!.steps} steps per cycle
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cycle Interval (sec)</label>
                  <input
                    type="number"
                    className="input-field"
                    min={5}
                    max={3600}
                    value={intervalSecs}
                    onChange={e => setIntervalSecs(Math.max(5, Number(e.target.value)))}
                    disabled={isActive}
                  />
                </div>
                <div>
                  <label className="label">Max Cycles (blank = ∞)</label>
                  <input
                    type="number"
                    className="input-field"
                    min={1}
                    placeholder="Unlimited"
                    value={maxCycles}
                    onChange={e => setMaxCycles(e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={isActive}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Controls card */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-white">Controls</h3>
            </div>
            <div className="card-body flex flex-wrap gap-3">
              {isIdle && (
                <button
                  className="btn-primary"
                  onClick={handleStart}
                  disabled={loading}
                >
                  ▶ Start Monitoring
                </button>
              )}
              {isRunning && (
                <button
                  className="btn-secondary"
                  onClick={handlePause}
                  disabled={loading}
                >
                  ⏸ Pause
                </button>
              )}
              {isPaused && (
                <button
                  className="btn-primary"
                  onClick={handleResume}
                  disabled={loading}
                >
                  ▶ Resume
                </button>
              )}
              {isActive && (
                <button
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-900/60 text-red-300 border border-red-700 hover:bg-red-900 transition-colors"
                  onClick={handleStop}
                  disabled={loading}
                >
                  ■ Stop
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Status Panel ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-white">Live Status</h3>
              {isActive && (
                <span className="flex items-center gap-1.5 text-xs text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                  Live
                </span>
              )}
            </div>
            <div className="card-body space-y-3 text-sm">

              {/* Phase indicator */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Phase</span>
                <span className={`font-semibold ${PHASE_COLORS[phase] ?? 'text-slate-300'}`}>
                  {PHASE_LABELS[phase] ?? phase}
                </span>
              </div>

              {status && isActive && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Location</span>
                    <span className="text-white">{status.location}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Scenario</span>
                    <span className="text-white capitalize">{status.scenario.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Cycles Completed</span>
                    <span className="text-white font-mono">{status.total_cycles}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Crises Detected</span>
                    <span className={`font-mono font-semibold ${status.crises_detected > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {status.crises_detected}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Cycle Interval</span>
                    <span className="text-white font-mono">{status.cycle_interval_seconds}s</span>
                  </div>
                  {status.started_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Started</span>
                      <span className="text-slate-300 text-xs">
                        {new Date(status.started_at).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </>
              )}

              {isIdle && (
                <p className="text-slate-500 text-xs">
                  Configure a location and scenario above, then click Start Monitoring.
                </p>
              )}

              {/* Current conditions */}
              {status?.current_conditions && isActive && (
                <div className="border-t border-slate-700 pt-3 mt-2">
                  <p className="text-slate-400 text-xs mb-2 font-medium uppercase tracking-wide">Current Conditions</p>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    {formatConditions(status.current_conditions)}
                  </p>
                </div>
              )}

              {/* Error */}
              {status?.last_error && (
                <div className="bg-red-900/20 border border-red-800 rounded p-2 text-red-400 text-xs">
                  Last error: {status.last_error}
                </div>
              )}
            </div>
          </div>

          {/* Latest crisis outcome */}
          {status?.last_outcome && (
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold text-white">Latest Crisis — Cycle {status.last_outcome.cycle}</h3>
              </div>
              <div className="card-body space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Disruptions Detected</span>
                  <span className="text-red-400 font-semibold">{status.last_outcome.crises_detected}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Shipments Affected</span>
                  <span className="text-white font-mono">{status.last_outcome.affected_shipments}</span>
                </div>
                {status.last_outcome.disruption_types.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Types</span>
                    <span className="text-orange-300 text-xs text-right max-w-48">
                      {status.last_outcome.disruption_types.join(', ')}
                    </span>
                  </div>
                )}
                {status.last_outcome.recommended_strategy && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recommended</span>
                    <span className="text-blue-300">{status.last_outcome.recommended_strategy}</span>
                  </div>
                )}
                {status.last_outcome.simulation_id && (
                  <div className="border-t border-slate-700 pt-2 text-xs text-slate-500">
                    Run ID: <span className="font-mono text-slate-400">{status.last_outcome.simulation_id.slice(0, 16)}…</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Session History ─────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-white">Auto Mode Sessions</h3>
          <button
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            onClick={fetchRuns}
          >
            Refresh
          </button>
        </div>
        <div className="card-body">
          {runs.length === 0 ? (
            <p className="text-slate-500 text-sm">No Auto Mode sessions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 text-xs uppercase tracking-wide border-b border-slate-700">
                    <th className="pb-2 pr-4">Session</th>
                    <th className="pb-2 pr-4">Location</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Cycles</th>
                    <th className="pb-2 pr-4">Crises</th>
                    <th className="pb-2">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => (
                    <tr key={run.run_id} className="border-b border-slate-800 hover:bg-slate-800/40">
                      <td className="py-2 pr-4 font-mono text-xs text-slate-400">
                        {run.run_id.slice(0, 12)}…
                      </td>
                      <td className="py-2 pr-4 text-white">{run.monitored_location ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          run.status === 'stopped' ? 'bg-slate-700 text-slate-400' :
                          run.status === 'monitoring' ? 'bg-green-900/50 text-green-400' :
                          run.status === 'paused' ? 'bg-yellow-900/50 text-yellow-400' :
                          run.status === 'error' ? 'bg-red-900/50 text-red-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-white font-mono">{run.total_cycles}</td>
                      <td className="py-2 pr-4">
                        <span className={`font-mono ${run.total_crises_detected > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {run.total_crises_detected}
                        </span>
                      </td>
                      <td className="py-2 text-slate-400 text-xs">
                        {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
