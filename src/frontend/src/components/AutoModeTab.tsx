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
import DigitalTwin from './DigitalTwin';
import {
  Play, Pause, Square, RefreshCw, Activity,
  AlertTriangle, CheckCircle2, Loader2, ArrowLeft,
  BrainCircuit, MapPin, Zap, Clock,
} from 'lucide-react';

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

const PHASE_BG: Record<string, string> = {
  idle:             'bg-slate-100 text-slate-600 border-slate-200',
  monitoring:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  condition_change: 'bg-amber-50 text-amber-700 border-amber-200',
  detection:        'bg-orange-50 text-orange-700 border-orange-200',
  analysis:         'bg-orange-50 text-orange-700 border-orange-200',
  simulation:       'bg-blue-50 text-blue-700 border-blue-200',
  recovery:         'bg-purple-50 text-purple-700 border-purple-200',
  explanation:      'bg-blue-50 text-blue-700 border-blue-200',
  recording:        'bg-teal-50 text-teal-700 border-teal-200',
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
    .join('  ·  ');
}

// ── Main component ────────────────────────────────────────────────────────────

interface AutoModeTabProps {
  onNavigate?: (section: string) => void;
}

export default function AutoModeTab({ onNavigate }: AutoModeTabProps = {}) {
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
    <div className="space-y-5">

      {/* Live status banner when running */}
      {isActive && (
        <div className={`rounded-xl border px-5 py-3 flex items-center gap-4 ${
          isRunning
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          {isRunning
            ? <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            : <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-semibold ${isRunning ? 'text-emerald-800' : 'text-amber-800'}`}>
              {isRunning ? 'Autonomous Monitoring Active' : 'Monitoring Paused'}
            </span>
            <span className="text-xs ml-3 text-slate-500">
              {status?.location} · {status?.scenario.replace(/_/g, ' ')} · {status?.total_cycles} cycles · {status?.crises_detected} crises
            </span>
          </div>
          <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 uppercase tracking-wide ${
            isRunning
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
              : 'bg-amber-100 text-amber-700 border-amber-200'
          }`}>
            {status?.status}
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Left: Configuration + Controls ─────────────────────────────── */}
        <div className="space-y-4">

          {/* Configuration card */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-800">Configuration</h3>
              {isActive && (
                <span className="ml-auto text-xs text-slate-400 italic">Stop monitoring to change</span>
              )}
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
                  <p className="text-xs text-slate-400 mt-1">
                    {scenarios.find(s => s.name === scenario)!.steps} simulation steps per cycle
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
                  <p className="text-xs text-slate-400 mt-0.5">Min 5s for demo</p>
                </div>
                <div>
                  <label className="label">Max Cycles</label>
                  <input
                    type="number"
                    className="input-field"
                    min={1}
                    placeholder="Unlimited"
                    value={maxCycles}
                    onChange={e => setMaxCycles(e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={isActive}
                  />
                  <p className="text-xs text-slate-400 mt-0.5">Leave blank = ∞</p>
                </div>
              </div>
            </div>
          </div>

          {/* Controls card */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-slate-800">Monitoring Controls</h3>
            </div>
            <div className="card-body">
              <div className="flex flex-wrap gap-2.5">
                {isIdle && (
                  <button
                    className="btn-primary flex items-center gap-2 text-sm"
                    onClick={handleStart}
                    disabled={loading}
                  >
                    {loading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Play className="w-4 h-4" />
                    }
                    Start Monitoring
                  </button>
                )}
                {isRunning && (
                  <button
                    className="btn-secondary flex items-center gap-2 text-sm"
                    onClick={handlePause}
                    disabled={loading}
                  >
                    {loading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Pause className="w-4 h-4" />
                    }
                    Pause
                  </button>
                )}
                {isPaused && (
                  <button
                    className="btn-primary flex items-center gap-2 text-sm"
                    onClick={handleResume}
                    disabled={loading}
                  >
                    {loading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Play className="w-4 h-4" />
                    }
                    Resume
                  </button>
                )}
                {isActive && (
                  <button
                    className="flex items-center gap-2 btn-danger text-sm"
                    onClick={handleStop}
                    disabled={loading}
                  >
                    {loading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Square className="w-4 h-4" />
                    }
                    Stop
                  </button>
                )}
                {!isActive && (
                  <button
                    className="btn-secondary flex items-center gap-2 text-sm"
                    onClick={() => { fetchStatus(); fetchRuns(); }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Status
                  </button>
                )}
              </div>
              {isIdle && (
                <p className="text-xs text-slate-400 mt-3">
                  Select a location and scenario above, then click Start Monitoring to begin
                  the autonomous causal-detection loop.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Live Status ──────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Status card */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Live Status</h3>
              {isActive && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  LIVE
                </span>
              )}
            </div>
            <div className="card-body space-y-3 text-sm">

              {/* Phase badge */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs">Phase</span>
                <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 capitalize ${
                  PHASE_BG[phase] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {PHASE_LABELS[phase] ?? phase}
                </span>
              </div>

              {status && isActive && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs flex items-center gap-1">
                      <MapPin className="w-3 h-3" />Location
                    </span>
                    <span className="text-slate-800 font-medium text-sm">{status.location}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs">Scenario</span>
                    <span className="text-slate-700 capitalize text-sm">{status.scenario.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />Cycles
                    </span>
                    <span className="text-slate-800 font-mono font-semibold">{status.total_cycles}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />Crises Detected
                    </span>
                    <span className={`font-mono font-semibold text-sm ${
                      status.crises_detected > 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}>
                      {status.crises_detected}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs">Cycle Interval</span>
                    <span className="text-slate-700 font-mono text-sm">{status.cycle_interval_seconds}s</span>
                  </div>
                  {status.started_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-xs">Started</span>
                      <span className="text-slate-500 text-xs">
                        {new Date(status.started_at).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </>
              )}

              {isIdle && (
                <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                  <Activity className="w-3.5 h-3.5" />
                  No monitoring session active. Configure and start above.
                </div>
              )}

              {/* Current conditions */}
              {status?.current_conditions && isActive && (
                <div className="border-t border-slate-100 pt-3 mt-1">
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-1.5">
                    Current Conditions
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {formatConditions(status.current_conditions)}
                  </p>
                </div>
              )}

              {/* Backend error */}
              {status?.last_error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-red-600 text-xs flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  Last error: {status.last_error}
                </div>
              )}
            </div>
          </div>

          {/* Latest crisis outcome */}
          {status?.last_outcome && (
            <div className={`card border-l-4 ${
              status.last_outcome.crises_detected > 0 ? 'border-l-red-500' : 'border-l-emerald-500'
            }`}>
              <div className="card-header flex items-center gap-2">
                {status.last_outcome.crises_detected > 0
                  ? <AlertTriangle className="w-4 h-4 text-red-500" />
                  : <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                }
                <h3 className="text-sm font-semibold text-slate-800">
                  Latest Result — Cycle {status.last_outcome.cycle}
                </h3>
              </div>
              <div className="card-body space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Crises Detected</span>
                  <span className={`font-semibold text-sm ${
                    status.last_outcome.crises_detected > 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}>
                    {status.last_outcome.crises_detected}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Shipments Affected</span>
                  <span className="text-slate-800 font-mono font-semibold">{status.last_outcome.affected_shipments}</span>
                </div>
                {status.last_outcome.disruption_types.length > 0 && (
                  <div className="flex justify-between items-start gap-3">
                    <span className="text-xs text-slate-500 flex-shrink-0">Disruption Types</span>
                    <span className="text-orange-700 text-xs text-right capitalize">
                      {status.last_outcome.disruption_types.map(t => t.replace(/_/g, ' ')).join(', ')}
                    </span>
                  </div>
                )}
                {status.last_outcome.recommended_strategy && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <BrainCircuit className="w-3 h-3 text-blue-500" />
                      AI Recommendation
                    </span>
                    <span className="text-blue-700 text-xs font-medium capitalize">
                      {status.last_outcome.recommended_strategy}
                    </span>
                  </div>
                )}
                {status.last_outcome.simulation_id && onNavigate && (
                  <div className="border-t border-slate-100 pt-2.5 flex gap-2">
                    <button
                      onClick={() => onNavigate('ai-recommendations')}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <BrainCircuit className="w-3 h-3" />
                      AI Analysis
                    </button>
                    <button
                      onClick={() => onNavigate('disruptions')}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Zap className="w-3 h-3" />
                      Disruptions
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Digital Twin — reflects autonomous crisis detection */}
      <DigitalTwin
        refreshTrigger={status?.total_cycles ?? 0}
        activeLocation={status?.location}
      />

      {/* Post-session navigation (when idle after running) */}
      {!isActive && runs.length > 0 && onNavigate && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700">Session complete — next steps</p>
            <p className="text-xs text-slate-500 mt-0.5">Review detected disruptions or return to the overview dashboard</p>
          </div>
          <button
            onClick={() => onNavigate('disruptions')}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
          >
            <Zap className="w-4 h-4" />
            View Disruptions
          </button>
          <button
            onClick={() => onNavigate('overview')}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Overview
          </button>
        </div>
      )}

      {/* ── Session History ─────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Session History</h3>
          <button
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
            onClick={fetchRuns}
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
        <div className="card-body p-0">
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Clock className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No sessions recorded yet</p>
              <p className="text-xs mt-0.5">Start monitoring to create the first session</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left text-slate-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Session</th>
                    <th className="text-left text-slate-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Location</th>
                    <th className="text-left text-slate-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Status</th>
                    <th className="text-right text-slate-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Cycles</th>
                    <th className="text-right text-slate-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Crises</th>
                    <th className="text-right text-slate-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wide">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => (
                    <tr key={run.run_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                        {run.run_id.slice(0, 12)}…
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 font-medium">{run.monitored_location ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium border rounded-full px-2 py-0.5 ${
                          run.status === 'stopped'    ? 'bg-slate-100 text-slate-600 border-slate-200' :
                          run.status === 'monitoring' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          run.status === 'paused'     ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          run.status === 'error'      ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700 font-mono">{run.total_cycles}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-mono font-semibold ${
                          run.total_crises_detected > 0 ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {run.total_crises_detected}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-400 text-xs">
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
