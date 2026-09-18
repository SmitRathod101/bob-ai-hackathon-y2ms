import { useState, useEffect, useRef } from 'react';
import {
  Settings, Zap, AlertTriangle, Loader2, RefreshCw,
  Plus, Trash2, Network, Activity, ChevronDown, ChevronUp,
  Thermometer, Cloud, Gauge, Truck, Anchor, Wind
} from 'lucide-react';
import {
  runManualSimulation, getConnections, getNodes,
  type ManualSimulationRequest, type ConditionInput, type DirectDisruptionInput,
  type ManualSimResult, type ConnectionRecord
} from '../services/api';
import ImpactSummaryPanel from './ImpactSummaryPanel';
import StrategyCards from './StrategyCards';
import ExplainableAI from './ExplainableAI';
import ColdChainPanel from './ColdChainPanel';
import FleetAvailabilityPanel from './FleetAvailabilityPanel';
import AffectedRoutesPanel from './AffectedRoutesPanel';
import { formatCurrency, formatDelay } from '../utils/format';
import type { FleetVehicle } from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

const SCOPE_TYPES = ['node', 'region', 'route', 'area'];

const DIRECT_DISRUPTION_TYPES = [
  { value: 'landslide',              label: 'Landslide' },
  { value: 'flood',                  label: 'Flood' },
  { value: 'road_blockage',          label: 'Road Blockage' },
  { value: 'bridge_failure',         label: 'Bridge Failure' },
  { value: 'port_closure',           label: 'Port Closure' },
  { value: 'severe_weather_event',   label: 'Severe Weather Event' },
  { value: 'vehicle_breakdown',      label: 'Vehicle Breakdown' },
  { value: 'cold_chain_failure',     label: 'Cold-Chain Equipment Failure' },
  { value: 'connection_interruption','label': 'Network/Connection Interruption' },
  { value: 'strike',                 label: 'Strike' },
  { value: 'warehouse_disruption',   label: 'Warehouse Disruption' },
];

const SEVERITY_OPTIONS = ['low', 'medium', 'high'] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

const emptyCondition = (): ConditionInput => ({
  scope_type: 'node',
  scope_name: '',
});

const emptyDisruption = (): DirectDisruptionInput => ({
  disruption_type: 'landslide',
  scope_type: 'node',
  scope_name: '',
  severity: 'medium',
  duration_hours: 24,
  capacity_reduction: 1.0,
});

const severityColor = (s: string) =>
  s === 'high' ? 'text-red-400 bg-red-900/30 border-red-700' :
  s === 'medium' ? 'text-yellow-400 bg-yellow-900/30 border-yellow-700' :
  'text-green-400 bg-green-900/30 border-green-700';

// ── Sub-components ────────────────────────────────────────────────────────────

function ConditionEditor({
  index, condition, nodes,
  onChange, onRemove,
}: {
  index: number;
  condition: ConditionInput;
  nodes: string[];
  onChange: (c: ConditionInput) => void;
  onRemove: () => void;
}) {
  const set = (key: string, value: unknown) => onChange({ ...condition, [key]: value });

  return (
    <div className="border border-slate-700 rounded-lg p-4 space-y-3 bg-slate-800/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Cloud className="w-3.5 h-3.5 text-blue-400" />
          Condition #{index + 1}
        </span>
        <button onClick={onRemove} className="text-slate-500 hover:text-red-400">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label text-xs">Scope Type</label>
          <select className="select-field text-xs py-1"
            value={condition.scope_type}
            onChange={e => set('scope_type', e.target.value)}>
            {SCOPE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Location / Node</label>
          <input
            className="input-field text-xs py-1"
            list={`nodes-list-${index}`}
            value={condition.scope_name}
            onChange={e => set('scope_name', e.target.value)}
            placeholder="e.g. Mumbai"
          />
          <datalist id={`nodes-list-${index}`}>
            {nodes.map(n => <option key={n} value={n} />)}
          </datalist>
        </div>
      </div>

      {/* Sliders for condition variables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">

        {/* Rainfall */}
        <div>
          <label className="label text-xs flex items-center gap-1">
            <Cloud className="w-3 h-3 text-blue-400" />
            Rainfall: <strong className="text-white ml-1">
              {condition.rainfall_mm != null ? `${condition.rainfall_mm} mm/h` : '—'}
            </strong>
          </label>
          <input type="range" min={0} max={200} step={5}
            value={condition.rainfall_mm ?? 0}
            onChange={e => set('rainfall_mm', Number(e.target.value) || undefined)}
            className="w-full accent-blue-500" />
          <div className="flex justify-between text-slate-600 text-xs">
            <span>0</span><span className="text-yellow-500">50mm↑ risk</span><span>200</span>
          </div>
        </div>

        {/* Temperature */}
        <div>
          <label className="label text-xs flex items-center gap-1">
            <Thermometer className="w-3 h-3 text-orange-400" />
            Temperature: <strong className="text-white ml-1">
              {condition.temperature_c != null ? `${condition.temperature_c}°C` : '—'}
            </strong>
          </label>
          <input type="range" min={-10} max={55} step={1}
            value={condition.temperature_c ?? 25}
            onChange={e => set('temperature_c', Number(e.target.value))}
            className="w-full accent-orange-500" />
          <div className="flex justify-between text-slate-600 text-xs">
            <span>-10°C</span><span className="text-red-500">42°+risk</span><span>55°C</span>
          </div>
        </div>

        {/* Traffic */}
        <div>
          <label className="label text-xs flex items-center gap-1">
            <Truck className="w-3 h-3 text-yellow-400" />
            Traffic: <strong className="text-white ml-1">
              {condition.traffic_level != null ? `${Math.round(condition.traffic_level * 100)}%` : '—'}
            </strong>
          </label>
          <input type="range" min={0} max={100} step={5}
            value={Math.round((condition.traffic_level ?? 0) * 100)}
            onChange={e => set('traffic_level', Number(e.target.value) / 100)}
            className="w-full accent-yellow-500" />
          <div className="flex justify-between text-slate-600 text-xs">
            <span>0%</span><span className="text-yellow-500">70%↑ risk</span><span>100%</span>
          </div>
        </div>

        {/* Road condition */}
        <div>
          <label className="label text-xs flex items-center gap-1">
            <Gauge className="w-3 h-3 text-purple-400" />
            Road Condition: <strong className="text-white ml-1">
              {condition.road_condition != null ? `${Math.round(condition.road_condition * 100)}%` : '—'}
            </strong>
          </label>
          <input type="range" min={0} max={100} step={5}
            value={Math.round((condition.road_condition ?? 100) * 100)}
            onChange={e => set('road_condition', Number(e.target.value) / 100)}
            className="w-full accent-purple-500" />
          <div className="flex justify-between text-slate-600 text-xs">
            <span>0% bad</span><span className="text-red-500">≤40% risk</span><span>100% perfect</span>
          </div>
        </div>

        {/* Port congestion */}
        <div>
          <label className="label text-xs flex items-center gap-1">
            <Anchor className="w-3 h-3 text-cyan-400" />
            Port Congestion: <strong className="text-white ml-1">
              {condition.port_congestion != null ? `${Math.round(condition.port_congestion * 100)}%` : '—'}
            </strong>
          </label>
          <input type="range" min={0} max={100} step={5}
            value={Math.round((condition.port_congestion ?? 0) * 100)}
            onChange={e => set('port_congestion', Number(e.target.value) / 100)}
            className="w-full accent-cyan-500" />
          <div className="flex justify-between text-slate-600 text-xs">
            <span>0%</span><span className="text-yellow-500">70%↑ risk</span><span>100%</span>
          </div>
        </div>

        {/* Weather severity */}
        <div>
          <label className="label text-xs flex items-center gap-1">
            <Wind className="w-3 h-3 text-teal-400" />
            Weather Severity: <strong className="text-white ml-1">
              {condition.weather_severity != null ? `${Math.round(condition.weather_severity * 100)}%` : '—'}
            </strong>
          </label>
          <input type="range" min={0} max={100} step={5}
            value={Math.round((condition.weather_severity ?? 0) * 100)}
            onChange={e => set('weather_severity', Number(e.target.value) / 100)}
            className="w-full accent-teal-500" />
          <div className="flex justify-between text-slate-600 text-xs">
            <span>0%</span><span className="text-red-500">75%↑ severe</span><span>100%</span>
          </div>
        </div>

      </div>
    </div>
  );
}

function DisruptionEditor({
  index, disruption, nodes,
  onChange, onRemove,
}: {
  index: number;
  disruption: DirectDisruptionInput;
  nodes: string[];
  onChange: (d: DirectDisruptionInput) => void;
  onRemove: () => void;
}) {
  const set = (key: string, value: unknown) => onChange({ ...disruption, [key]: value });

  return (
    <div className="border border-orange-800/50 rounded-lg p-4 space-y-3 bg-orange-950/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-orange-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          Disruption #{index + 1}
        </span>
        <button onClick={onRemove} className="text-slate-500 hover:text-red-400">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <label className="label text-xs">Disruption Type</label>
          <select className="select-field text-xs py-1"
            value={disruption.disruption_type}
            onChange={e => set('disruption_type', e.target.value)}>
            {DIRECT_DISRUPTION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs">Scope Type</label>
          <select className="select-field text-xs py-1"
            value={disruption.scope_type}
            onChange={e => set('scope_type', e.target.value)}>
            {SCOPE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Affected Location</label>
          <input
            className="input-field text-xs py-1"
            list={`dis-nodes-${index}`}
            value={disruption.scope_name}
            onChange={e => set('scope_name', e.target.value)}
            placeholder="e.g. Mumbai"
          />
          <datalist id={`dis-nodes-${index}`}>
            {nodes.map(n => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div>
          <label className="label text-xs">Severity</label>
          <div className="flex gap-1">
            {SEVERITY_OPTIONS.map(s => (
              <button key={s} onClick={() => set('severity', s)}
                className={`flex-1 py-1 rounded text-xs font-medium capitalize transition-colors ${
                  disruption.severity === s
                    ? s === 'high' ? 'bg-red-600 text-white' : s === 'medium' ? 'bg-yellow-600 text-white' : 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}>{s}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label text-xs">Duration: <strong className="text-white">{disruption.duration_hours}h</strong></label>
          <input type="range" min={1} max={168} step={1}
            value={disruption.duration_hours}
            onChange={e => set('duration_hours', Number(e.target.value))}
            className="w-full accent-orange-500" />
        </div>
        <div>
          <label className="label text-xs">Capacity Blocked: <strong className="text-white">{Math.round(disruption.capacity_reduction * 100)}%</strong></label>
          <input type="range" min={10} max={100} step={10}
            value={Math.round(disruption.capacity_reduction * 100)}
            onChange={e => set('capacity_reduction', Number(e.target.value) / 100)}
            className="w-full accent-orange-500" />
        </div>
      </div>

      <div>
        <label className="label text-xs">Causal Reason (optional)</label>
        <textarea
          className="input-field text-xs py-1 resize-none"
          rows={2}
          value={disruption.causal_reason || ''}
          onChange={e => set('causal_reason', e.target.value)}
          placeholder="Describe what caused this disruption..."
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ManualModeTab() {
  const [conditions, setConditions] = useState<ConditionInput[]>([emptyCondition()]);
  const [disruptions, setDisruptions] = useState<DirectDisruptionInput[]>([]);
  const [interruptConnIds, setInterruptConnIds] = useState<string[]>([]);
  const [runLabel, setRunLabel] = useState('');

  const [nodes, setNodes] = useState<string[]>([]);
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ManualSimResult | null>(null);

  const [showConnections, setShowConnections] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load nodes and connections on mount
  useEffect(() => {
    getNodes().then(r => setNodes(r.nodes)).catch(() => {});
    loadConnections();
  }, []);

  const loadConnections = async () => {
    setLoadingConnections(true);
    try {
      const conns = await getConnections();
      setConnections(conns);
    } catch {
      // bootstrap may not have run yet — ok
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const req: ManualSimulationRequest = {
        conditions: conditions.filter(c => c.scope_name),
        direct_disruptions: disruptions.filter(d => d.scope_name),
        interrupt_connection_ids: interruptConnIds,
        run_label: runLabel || undefined,
        include_explanation: true,
      };
      const res = await runManualSimulation(req);
      setResult(res);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleInterruptConn = (connId: string) => {
    setInterruptConnIds(ids =>
      ids.includes(connId) ? ids.filter(id => id !== connId) : [...ids, connId]
    );
  };

  const addCondition = () => setConditions(c => [...c, emptyCondition()]);
  const removeCondition = (i: number) => setConditions(c => c.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, c: ConditionInput) =>
    setConditions(all => all.map((v, idx) => idx === i ? c : v));

  const addDisruption = () => setDisruptions(d => [...d, emptyDisruption()]);
  const removeDisruption = (i: number) => setDisruptions(d => d.filter((_, idx) => idx !== i));
  const updateDisruption = (i: number, d: DirectDisruptionInput) =>
    setDisruptions(all => all.map((v, idx) => idx === i ? d : v));

  const causalInfo = result?.causal_info;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" />
            Manual Mode
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Manipulate environmental conditions and inject disruptions — ChainMind performs the full analysis
          </p>
        </div>
        {result && (
          <button
            onClick={() => { setResult(null); setError(null); }}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Clear Results
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Input Panel ─────────────────────────────────── */}
        <div className="xl:col-span-1 space-y-4">

          {/* Run label */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-slate-200">Run Settings</h3>
            </div>
            <div className="card-body">
              <label className="label text-xs">Run Label (optional)</label>
              <input
                className="input-field text-sm"
                value={runLabel}
                onChange={e => setRunLabel(e.target.value)}
                placeholder="e.g. Mumbai Monsoon — Day 3"
              />
            </div>
          </div>

          {/* Conditions */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-200">Environmental Conditions</h3>
                <span className="text-xs text-slate-500">({conditions.length})</span>
              </div>
              <button onClick={addCondition}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <div className="card-body space-y-3">
              {conditions.map((c, i) => (
                <ConditionEditor key={i} index={i} condition={c} nodes={nodes}
                  onChange={nc => updateCondition(i, nc)}
                  onRemove={() => removeCondition(i)} />
              ))}
              {conditions.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-2">
                  No conditions — click "Add" to set environmental conditions
                </p>
              )}
            </div>
          </div>

          {/* Direct Disruptions */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-semibold text-slate-200">Direct Disruptions</h3>
                <span className="text-xs text-slate-500">({disruptions.length})</span>
              </div>
              <button onClick={addDisruption}
                className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <div className="card-body space-y-3">
              {disruptions.map((d, i) => (
                <DisruptionEditor key={i} index={i} disruption={d} nodes={nodes}
                  onChange={nd => updateDisruption(i, nd)}
                  onRemove={() => removeDisruption(i)} />
              ))}
              {disruptions.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-2">
                  No direct disruptions — add one or let conditions drive disruptions causally
                </p>
              )}
            </div>
          </div>

          {/* Network Connections */}
          <div className="card">
            <div className="card-header flex items-center justify-between cursor-pointer"
              onClick={() => setShowConnections(v => !v)}>
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-200">Interrupt Connections</h3>
                {interruptConnIds.length > 0 && (
                  <span className="text-xs bg-red-900/40 text-red-400 border border-red-700 px-2 py-0.5 rounded-full">
                    {interruptConnIds.length} selected
                  </span>
                )}
              </div>
              {showConnections ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
            {showConnections && (
              <div className="card-body">
                {loadingConnections ? (
                  <div className="flex items-center justify-center py-4 text-slate-400 text-xs gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />Loading connections...
                  </div>
                ) : connections.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-2">
                    Connections will be bootstrapped from routes on first use
                  </p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {connections.slice(0, 50).map(conn => (
                      <div key={conn.connection_id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs transition-colors ${
                          interruptConnIds.includes(conn.connection_id)
                            ? 'bg-red-900/40 border border-red-700'
                            : 'hover:bg-slate-700 border border-transparent'
                        }`}
                        onClick={() => toggleInterruptConn(conn.connection_id)}>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          conn.status === 'unavailable' ? 'bg-red-500' :
                          conn.status === 'degraded' ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                        <span className="flex-1 truncate text-slate-200">{conn.name || `${conn.from_node}→${conn.to_node}`}</span>
                        <span className="text-slate-500 flex-shrink-0">{conn.transport_mode}</span>
                        {interruptConnIds.includes(conn.connection_id) && (
                          <span className="text-red-400 font-medium flex-shrink-0">INTERRUPT</span>
                        )}
                      </div>
                    ))}
                    {connections.length > 50 && (
                      <p className="text-xs text-slate-500 text-center py-1">
                        Showing first 50 of {connections.length} connections
                      </p>
                    )}
                  </div>
                )}
                <button onClick={loadConnections} className="mt-2 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh connections
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-xs">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Running analysis...</>
            ) : (
              <><Zap className="w-4 h-4" />Run Manual Simulation</>
            )}
          </button>

          <p className="text-xs text-slate-500 text-center">
            ChainMind will compute all impacts, risks, and recovery strategies automatically
          </p>
        </div>

        {/* ── Right column ───────────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Causal info panel — always visible after run */}
          {result && causalInfo && (
            <div className="card border-purple-700/50">
              <div className="card-header flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-purple-300">Causal Analysis</h3>
              </div>
              <div className="card-body space-y-3">
                {/* Narrative */}
                {causalInfo.causal_narrative && (
                  <div className="text-xs text-slate-300 bg-slate-800/50 rounded p-3 border border-slate-700">
                    {causalInfo.causal_narrative}
                  </div>
                )}

                {/* Violations */}
                {causalInfo.violations.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1.5">Threshold Violations</p>
                    <div className="space-y-1">
                      {causalInfo.violations.map((v, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs p-2 bg-yellow-900/20 border border-yellow-800/40 rounded">
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-yellow-300 font-medium">
                              {v.condition.replace('_', ' ')} = {v.value?.toFixed(1)} at {v.scope}
                            </span>
                            <br />
                            <span className="text-slate-400">{v.consequence}</span>
                          </div>
                          <span className={`ml-auto text-xs px-1.5 py-0.5 rounded border ${severityColor(v.severity)}`}>
                            {v.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generated disruptions */}
                {causalInfo.generated_disruptions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1.5">
                      Generated Disruptions ({causalInfo.generated_disruptions.length})
                    </p>
                    <div className="space-y-1">
                      {causalInfo.generated_disruptions.map((d, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs p-2 bg-red-900/20 border border-red-800/40 rounded">
                          <Zap className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="text-red-300 font-medium">
                              {d.disruption_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} at {d.scope_name}
                            </span>
                            <br />
                            <span className="text-slate-400 line-clamp-2">{d.causal_reason}</span>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${severityColor(d.severity)}`}>
                            {d.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connection impact */}
                {result.connection_impact && Object.keys(result.connection_impact).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1.5">Connection Interruptions</p>
                    {Object.entries(result.connection_impact).map(([connId, impact]) => (
                      <div key={connId} className="text-xs p-2 bg-slate-800 border border-red-800/40 rounded mb-1">
                        <span className="text-red-300 font-medium">
                          {impact.connection?.name || connId}
                        </span>
                        {' — '}
                        <span className="text-slate-400">
                          {impact.affected_route_count} routes, {impact.affected_shipment_count} shipments affected
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No result placeholder */}
          {!result && !loading && (
            <div className="card p-8 text-center">
              <Settings className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-slate-400 font-medium mb-1">Manual Mode Ready</h3>
              <p className="text-slate-500 text-sm">
                Set conditions, add direct disruptions or interrupt connections on the left,
                then click <strong className="text-slate-300">Run Manual Simulation</strong>.
              </p>
              <p className="text-slate-600 text-xs mt-3">
                ChainMind's Causal Engine will convert conditions into disruptions automatically.
              </p>
            </div>
          )}

          {loading && (
            <div className="card p-8 text-center">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-300 font-medium">Running causal analysis and simulation...</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Results section ─────────────────────────────── */}
      {result && (
        <div ref={resultsRef} className="space-y-6">

          {/* Impact header */}
          <div className="bg-red-900/20 border border-red-700/60 rounded-xl p-5">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <h3 className="text-base font-semibold text-red-300 flex-1">
                Manual Mode Impact — {result.scenario?.location}
                {result.run_label && (
                  <span className="text-slate-400 text-sm font-normal ml-2">({result.run_label})</span>
                )}
              </h3>
              <span className={`badge capitalize text-xs ${
                result.scenario?.severity === 'high' ? 'badge-critical' :
                result.scenario?.severity === 'medium' ? 'badge-high' : 'badge-medium'
              }`}>
                {result.scenario?.severity} severity
              </span>
              <span className="text-xs text-slate-500 font-mono">
                ID: {result.simulation_id?.slice(-8)}
              </span>
            </div>
            <ImpactSummaryPanel impact={result.impact_summary} />
          </div>

          {/* Affected routes + fleet */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <AffectedRoutesPanel
              disruptedRouteIds={result.disrupted_route_ids ?? []}
              disruptedLocation={result.scenario?.location ?? ''}
              disrupted_routes_count={result.impact_summary?.disrupted_routes ?? 0}
            />
            <FleetAvailabilityPanel
              fleetSummary={result.fleet_summary}
              availableFleet={result.available_fleet as FleetVehicle[]}
              coldChainFleet={result.cold_chain_fleet as FleetVehicle[]}
              fleetRequirements={result.fleet_requirements}
            />
          </div>

          {/* Cold chain */}
          <ColdChainPanel
            shipments={result.top_risk_shipments ?? []}
            totalAtRisk={result.impact_summary?.cold_chain_at_risk ?? 0}
          />

          {/* Strategies */}
          <StrategyCards strategies={result.strategies ?? []} />

          {/* AI explanation */}
          {result.explanation && <ExplainableAI explanation={result.explanation} />}

          {/* Event timeline */}
          {result.simulation_events && result.simulation_events.length > 0 && (
            <div className="card">
              <div className="card-header flex items-center justify-between cursor-pointer"
                onClick={() => setShowEvents(v => !v)}>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-slate-200">Crisis Operations Timeline</h3>
                  <span className="text-xs text-slate-500">({result.simulation_events.length} events)</span>
                </div>
                {showEvents ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
              {showEvents && (
                <div className="card-body">
                  <div className="space-y-2">
                    {result.simulation_events.map((ev, i) => (
                      <div key={ev.event_id} className="flex gap-3 text-xs">
                        <div className="flex flex-col items-center">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${
                            ev.severity === 'high' ? 'bg-red-500' :
                            ev.severity === 'medium' ? 'bg-yellow-500' :
                            ev.stage === 'condition_changed' ? 'bg-blue-500' :
                            ev.stage === 'disruption_detected' ? 'bg-orange-500' :
                            'bg-green-500'
                          }`} />
                          {i < result.simulation_events!.length - 1 && (
                            <div className="w-px flex-1 bg-slate-700 mt-1 mb-1 min-h-[12px]" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 uppercase text-xs tracking-wide">{ev.stage?.replace('_', ' ')}</span>
                            {ev.severity && ev.severity !== 'info' && (
                              <span className={`text-xs px-1.5 py-0.5 rounded border ${severityColor(ev.severity)}`}>
                                {ev.severity}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-200 mt-0.5">{ev.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Top risk shipments */}
          {result.top_risk_shipments && result.top_risk_shipments.length > 0 && (
            <div className="card">
              <div className="card-header flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-semibold text-slate-200">Top Risk Shipments</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/40">
                      <th className="text-left text-slate-400 font-medium px-4 py-2.5">Shipment ID</th>
                      <th className="text-center text-slate-400 font-medium px-4 py-2.5">Risk</th>
                      <th className="text-right text-slate-400 font-medium px-4 py-2.5">Delay</th>
                      <th className="text-right text-slate-400 font-medium px-4 py-2.5">Cargo Value</th>
                      <th className="text-center text-slate-400 font-medium px-4 py-2.5">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.top_risk_shipments.slice(0, 10).map(s => (
                      <tr key={s.shipment_id} className="border-b border-slate-800 hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-mono text-slate-200 text-xs">{s.shipment_id}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`badge capitalize badge-${s.risk_level} text-xs`}>{s.risk_level}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-200">{formatDelay(s.delay_hours)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-200">{formatCurrency(s.cargo_value)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                            s.is_direct ? 'bg-red-900/40 text-red-300' : 'bg-orange-900/40 text-orange-300'
                          }`}>
                            {s.is_direct ? 'Direct' : 'Cascade'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
