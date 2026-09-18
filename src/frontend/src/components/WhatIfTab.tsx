import { useState } from 'react';
import type { SimulationRequest, WhatIfResult } from '../services/api';
import { runWhatIf } from '../services/api';
import { formatCurrency, formatDelay } from '../utils/format';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend,
} from 'recharts';
import { GitCompare, Plus, Trash2, Loader2, TrendingUp, TrendingDown, Minus, ArrowRight, Zap } from 'lucide-react';

const DISRUPTION_TYPES = [
  { value: 'port_closure', label: 'Port Closure' },
  { value: 'route_closure', label: 'Route Closure' },
  { value: 'severe_weather', label: 'Severe Weather' },
  { value: 'strike', label: 'Strike' },
  { value: 'vehicle_shortage', label: 'Vehicle Shortage' },
  { value: 'warehouse_disruption', label: 'Warehouse Disruption' },
];

const LOCATIONS = [
  'Mumbai Port', 'JNPT', 'Mundra', 'Chennai', 'Kolkata',
  'Kochi', 'Visakhapatnam', 'Kandla', 'Delhi', 'Ahmedabad', 'Bengaluru', 'Hyderabad',
];

const DARK_TOOLTIP = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 },
};

// Quick-start presets for common what-if explorations
const QUICK_PRESETS: Array<{ label: string; description: string; scenarios: SimulationRequest[] }> = [
  {
    label: 'Duration Escalation',
    description: 'Mumbai Port closure — 72h vs 120h',
    scenarios: [
      { disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 72, severity: 'high', capacity_reduction: 1.0 },
      { disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 120, severity: 'high', capacity_reduction: 1.0 },
    ],
  },
  {
    label: 'Severity Comparison',
    description: 'JNPT Strike — medium vs high severity',
    scenarios: [
      { disruption_type: 'strike', location: 'JNPT', duration_hours: 96, severity: 'medium', capacity_reduction: 0.6 },
      { disruption_type: 'strike', location: 'JNPT', duration_hours: 96, severity: 'high', capacity_reduction: 1.0 },
    ],
  },
  {
    label: 'Port vs Port',
    description: 'Mumbai Port vs Chennai Port closure (72h)',
    scenarios: [
      { disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 72, severity: 'high', capacity_reduction: 1.0 },
      { disruption_type: 'port_closure', location: 'Chennai', duration_hours: 72, severity: 'high', capacity_reduction: 1.0 },
    ],
  },
  {
    label: '3-Way Duration',
    description: 'Mumbai Port 48h / 72h / 120h',
    scenarios: [
      { disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 48, severity: 'high', capacity_reduction: 1.0 },
      { disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 72, severity: 'high', capacity_reduction: 1.0 },
      { disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 120, severity: 'high', capacity_reduction: 1.0 },
    ],
  },
];

const DEFAULT_SCENARIOS: SimulationRequest[] = [
  { disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 72, severity: 'high', capacity_reduction: 1.0 },
  { disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 120, severity: 'high', capacity_reduction: 1.0 },
];

export default function WhatIfTab() {
  const [scenarios, setScenarios] = useState<SimulationRequest[]>(DEFAULT_SCENARIOS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WhatIfResult | null>(null);

  const addScenario = () => {
    if (scenarios.length < 5) {
      setScenarios([...scenarios, {
        disruption_type: 'port_closure', location: 'Mumbai Port',
        duration_hours: 48, severity: 'medium', capacity_reduction: 0.8,
      }]);
    }
  };

  const removeScenario = (idx: number) => {
    if (scenarios.length > 2) setScenarios(scenarios.filter((_, i) => i !== idx));
  };

  const updateScenario = (idx: number, field: keyof SimulationRequest, value: string | number) => {
    setScenarios(scenarios.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const loadPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setScenarios(preset.scenarios);
    setResult(null);
    setError(null);
  };

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runWhatIf(scenarios);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">What-If Scenario Comparison</h2>
        <p className="text-slate-400 text-sm mt-0.5">
          The supply-chain time machine — compare multiple disruption scenarios side-by-side
        </p>
      </div>

      {/* Quick Presets */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-semibold text-slate-200">Quick Presets</span>
        </div>
        <div className="card-body pt-3 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => loadPreset(preset)}
              className="text-left bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-blue-600 px-3 py-2.5 rounded-lg transition-colors"
            >
              <div className="text-xs font-semibold text-slate-200">{preset.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Scenario Configuration */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-200">Configure Scenarios</h3>
            <span className="text-xs text-slate-500">({scenarios.length}/5)</span>
          </div>
          <button onClick={addScenario} disabled={scenarios.length >= 5} className="btn-secondary flex items-center gap-1 text-xs">
            <Plus className="w-3 h-3" /> Add Scenario
          </button>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((s, idx) => (
              <div key={idx} className="bg-slate-800/60 border border-slate-600 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      idx === 0 ? 'bg-blue-600' : idx === 1 ? 'bg-purple-600' : idx === 2 ? 'bg-orange-600' : 'bg-pink-600'
                    }`}>{idx + 1}</span>
                    <span className="text-sm font-medium text-slate-200">Scenario {idx + 1}</span>
                  </div>
                  {scenarios.length > 2 && (
                    <button onClick={() => removeScenario(idx)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="label">Disruption Type</label>
                  <select className="select-field text-xs" value={s.disruption_type}
                    onChange={e => updateScenario(idx, 'disruption_type', e.target.value)}>
                    {DISRUPTION_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Location</label>
                  <select className="select-field text-xs" value={s.location}
                    onChange={e => updateScenario(idx, 'location', e.target.value)}>
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Duration: {s.duration_hours}h ({(s.duration_hours / 24).toFixed(1)} days)</label>
                  <input type="range" min={6} max={240} step={6} value={s.duration_hours}
                    onChange={e => updateScenario(idx, 'duration_hours', Number(e.target.value))}
                    className="w-full accent-blue-500" />
                </div>
                <div>
                  <label className="label">Severity</label>
                  <div className="grid grid-cols-3 gap-1">
                    {['low', 'medium', 'high'].map(sev => (
                      <button key={sev} onClick={() => updateScenario(idx, 'severity', sev)}
                        className={`py-1 rounded text-xs font-medium capitalize transition-colors ${
                          s.severity === sev
                            ? sev === 'high' ? 'bg-red-600 text-white'
                              : sev === 'medium' ? 'bg-yellow-600 text-white'
                              : 'bg-green-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}>
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-xs">{error}</div>
          )}

          <button onClick={handleRun} disabled={loading}
            className="mt-4 btn-primary flex items-center gap-2">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Running {scenarios.length} scenarios...</>
              : <><GitCompare className="w-4 h-4" />Compare Scenarios</>}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Header banner */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-5">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-semibold text-blue-300">What-If Comparison Results</h3>
              <span className="text-xs text-slate-400">
                {result.comparison.scenario_labels.length} scenarios compared
              </span>
            </div>
            {result.comparison.delay_increase_pct > 0 && (
              <p className="text-sm text-slate-300">
                Worst-case scenario causes <strong className="text-red-400">{result.comparison.delay_increase_pct}%</strong> more
                delay than best-case scenario — <strong className="text-green-400">{result.comparison.scenario_labels[result.comparison.best_scenario_idx]}</strong> is least severe.
              </p>
            )}
          </div>

          {/* Quick delta summary cards (best vs worst) */}
          {result.scenarios.length >= 2 && (() => {
            const best = result.scenarios[result.comparison.best_scenario_idx];
            const worst = result.scenarios[result.comparison.worst_scenario_idx];
            const bestLabel = result.comparison.scenario_labels[result.comparison.best_scenario_idx];
            const worstLabel = result.comparison.scenario_labels[result.comparison.worst_scenario_idx];
            const delayDelta = worst.impact_summary.average_delay_hours - best.impact_summary.average_delay_hours;
            const shipmentDelta = worst.impact_summary.total_affected_shipments - best.impact_summary.total_affected_shipments;
            const valueDelta = worst.impact_summary.total_cargo_value_exposed - best.impact_summary.total_cargo_value_exposed;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <WhatIfDeltaCard
                  label="Delay Impact"
                  best={`${best.impact_summary.average_delay_hours.toFixed(1)}h`}
                  worst={`${worst.impact_summary.average_delay_hours.toFixed(1)}h`}
                  delta={`+${delayDelta.toFixed(1)}h`}
                  worstLabel={worstLabel}
                  bestLabel={bestLabel}
                />
                <WhatIfDeltaCard
                  label="Affected Shipments"
                  best={best.impact_summary.total_affected_shipments.toString()}
                  worst={worst.impact_summary.total_affected_shipments.toString()}
                  delta={`+${shipmentDelta}`}
                  worstLabel={worstLabel}
                  bestLabel={bestLabel}
                />
                <WhatIfDeltaCard
                  label="Cargo at Risk"
                  best={formatCurrency(best.impact_summary.total_cargo_value_exposed)}
                  worst={formatCurrency(worst.impact_summary.total_cargo_value_exposed)}
                  delta={valueDelta > 0 ? `+${formatCurrency(valueDelta)}` : '='}
                  worstLabel={worstLabel}
                  bestLabel={bestLabel}
                />
                <WhatIfDeltaCard
                  label="Cold-Chain at Risk"
                  best={best.impact_summary.cold_chain_at_risk.toString()}
                  worst={worst.impact_summary.cold_chain_at_risk.toString()}
                  delta={`+${worst.impact_summary.cold_chain_at_risk - best.impact_summary.cold_chain_at_risk}`}
                  worstLabel={worstLabel}
                  bestLabel={bestLabel}
                />
              </div>
            );
          })()}

          {/* Delta diff table (only for exactly 2 scenarios) */}
          {result.scenarios.length === 2 && (
            <DeltaComparisonTable
              a={result.scenarios[0]}
              b={result.scenarios[1]}
              labelA={result.comparison.scenario_labels[0]}
              labelB={result.comparison.scenario_labels[1]}
            />
          )}

          {/* Charts row */}
          <ComparisonCharts comparison={result.comparison} />

          {/* Radar chart for multi-dim comparison (only 2 scenarios for clarity) */}
          {result.scenarios.length === 2 && (
            <RadarComparisonChart
              a={result.scenarios[0]}
              b={result.scenarios[1]}
              labelA={result.comparison.scenario_labels[0]}
              labelB={result.comparison.scenario_labels[1]}
            />
          )}

          {/* Side-by-side Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.scenarios.map((scenario, idx) => (
              <ScenarioResultCard
                key={scenario.simulation_id}
                scenario={scenario}
                label={result.comparison.scenario_labels[idx]}
                colorIdx={idx}
                isWorst={idx === result.comparison.worst_scenario_idx}
                isBest={idx === result.comparison.best_scenario_idx}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Delta Comparison Table (2-scenario side-by-side) ─────────────────────────

function DeltaComparisonTable({
  a, b, labelA, labelB,
}: {
  a: WhatIfResult['scenarios'][0];
  b: WhatIfResult['scenarios'][0];
  labelA: string;
  labelB: string;
}) {
  const ia = a.impact_summary;
  const ib = b.impact_summary;
  const ra = a.recommended_strategy;
  const rb = b.recommended_strategy;

  type MetricRow = {
    label: string;
    valA: string;
    valB: string;
    rawA: number;
    rawB: number;
    unit: string;
    higherIsBetter: boolean;
  };

  const rows: MetricRow[] = [
    {
      label: 'Affected Shipments',
      valA: ia.total_affected_shipments.toString(),
      valB: ib.total_affected_shipments.toString(),
      rawA: ia.total_affected_shipments,
      rawB: ib.total_affected_shipments,
      unit: 'shipments',
      higherIsBetter: false,
    },
    {
      label: 'Cargo Value Exposed',
      valA: formatCurrency(ia.total_cargo_value_exposed),
      valB: formatCurrency(ib.total_cargo_value_exposed),
      rawA: ia.total_cargo_value_exposed,
      rawB: ib.total_cargo_value_exposed,
      unit: '₹',
      higherIsBetter: false,
    },
    {
      label: 'Average Delay',
      valA: formatDelay(ia.average_delay_hours),
      valB: formatDelay(ib.average_delay_hours),
      rawA: ia.average_delay_hours,
      rawB: ib.average_delay_hours,
      unit: 'h',
      higherIsBetter: false,
    },
    {
      label: 'High Priority Affected',
      valA: ia.high_priority_affected.toString(),
      valB: ib.high_priority_affected.toString(),
      rawA: ia.high_priority_affected,
      rawB: ib.high_priority_affected,
      unit: 'shipments',
      higherIsBetter: false,
    },
    {
      label: 'Cold-Chain at Risk',
      valA: ia.cold_chain_at_risk.toString(),
      valB: ib.cold_chain_at_risk.toString(),
      rawA: ia.cold_chain_at_risk,
      rawB: ib.cold_chain_at_risk,
      unit: 'shipments',
      higherIsBetter: false,
    },
    {
      label: 'Recovery Cost (Recommended)',
      valA: ra ? formatCurrency(ra.additional_cost_inr) : '—',
      valB: rb ? formatCurrency(rb.additional_cost_inr) : '—',
      rawA: ra?.additional_cost_inr ?? 0,
      rawB: rb?.additional_cost_inr ?? 0,
      unit: '₹',
      higherIsBetter: false,
    },
  ];

  // Check if recommended strategy changed
  const strategyChanged = ra && rb && ra.strategy_type !== rb.strategy_type;

  return (
    <div className="card">
      <div className="card-header flex items-center gap-2">
        <ArrowRight className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-200">Side-by-Side Delta Comparison</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/40">
              <th className="text-left text-slate-400 font-medium px-5 py-2.5 w-44">Metric</th>
              <th className="text-center text-blue-400 font-semibold px-4 py-2.5">
                <span className="flex items-center justify-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                  {labelA.length > 24 ? labelA.slice(0, 24) + '…' : labelA}
                </span>
              </th>
              <th className="text-center text-purple-400 font-semibold px-4 py-2.5">
                <span className="flex items-center justify-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                  {labelB.length > 24 ? labelB.slice(0, 24) + '…' : labelB}
                </span>
              </th>
              <th className="text-center text-slate-400 font-medium px-4 py-2.5">Δ Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const diff = row.rawB - row.rawA;
              const pct = row.rawA > 0 ? (diff / row.rawA) * 100 : 0;
              const worsened = row.higherIsBetter ? diff < 0 : diff > 0;
              const improved = row.higherIsBetter ? diff > 0 : diff < 0;

              return (
                <tr key={row.label} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="px-5 py-3 text-slate-400 font-medium text-xs">{row.label}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-slate-200 font-medium">{row.valA}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-medium ${worsened ? 'text-red-300' : improved ? 'text-green-300' : 'text-slate-200'}`}>
                      {row.valB}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {diff === 0 ? (
                      <span className="flex items-center justify-center gap-1 text-slate-500 text-xs">
                        <Minus className="w-3 h-3" /> No change
                      </span>
                    ) : (
                      <span className={`flex items-center justify-center gap-1 text-xs font-medium ${
                        worsened ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {worsened
                          ? <TrendingUp className="w-3 h-3" />
                          : <TrendingDown className="w-3 h-3" />
                        }
                        {diff > 0 ? '+' : ''}{pct.toFixed(1)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {strategyChanged && (
        <div className="px-5 py-3 bg-yellow-900/20 border-t border-yellow-700/40 flex items-center gap-2">
          <span className="text-yellow-400 text-sm font-semibold">⚠ Recommendation changed:</span>
          <span className="text-slate-300 text-sm">
            <span className="text-blue-400 capitalize">{ra?.strategy_type}</span>
            {' → '}
            <span className="text-purple-400 capitalize">{rb?.strategy_type}</span>
            {' '}as conditions worsen
          </span>
        </div>
      )}
    </div>
  );
}

// ── Comparison Bar Charts ─────────────────────────────────────────────────────

function ComparisonCharts({ comparison }: { comparison: WhatIfResult['comparison'] }) {
  const affected = comparison.metrics['total_affected_shipments'] ?? [];
  const delays = comparison.metrics['average_delay_hours'] ?? [];
  const values = comparison.metrics['total_cargo_value_exposed'] ?? [];

  const COLORS = ['#3b82f6', '#8b5cf6', '#f97316', '#ec4899'];

  const chartData = comparison.scenario_labels.map((label, i) => ({
    label: label.length > 18 ? label.substring(0, 18) + '…' : label,
    affected: affected[i] ?? 0,
    delay: Math.round((delays[i] ?? 0) * 10) / 10,
    value: Math.round((values[i] ?? 0) / 1_00_000),
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[
        { key: 'affected' as const, name: 'Affected Shipments', color: '#ef4444', label: 'Shipments' },
        { key: 'delay' as const, name: 'Average Delay (hours)', color: '#f97316', label: 'Hours' },
        { key: 'value' as const, name: 'Cargo Exposed (₹ Lakhs)', color: '#8b5cf6', label: '₹L' },
      ].map(({ key, name, color, label }) => (
        <div key={key} className="card">
          <div className="card-header"><h3 className="text-sm font-semibold text-slate-200">{name}</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ left: -10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip {...DARK_TOOLTIP} />
                <Bar dataKey={key} name={label} fill={color} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Radar Chart (2-scenario multi-dim comparison) ────────────────────────────

function RadarComparisonChart({
  a, b, labelA, labelB,
}: {
  a: WhatIfResult['scenarios'][0];
  b: WhatIfResult['scenarios'][0];
  labelA: string;
  labelB: string;
}) {
  const ia = a.impact_summary;
  const ib = b.impact_summary;
  // Normalize each metric to 0–100 relative to the max of the two
  const normalize = (va: number, vb: number) => {
    const mx = Math.max(va, vb, 1);
    return { a: Math.round((va / mx) * 100), b: Math.round((vb / mx) * 100) };
  };

  const n_affected = normalize(ia.total_affected_shipments, ib.total_affected_shipments);
  const n_delay = normalize(ia.average_delay_hours, ib.average_delay_hours);
  const n_value = normalize(ia.total_cargo_value_exposed, ib.total_cargo_value_exposed);
  const n_coldchain = normalize(ia.cold_chain_at_risk, ib.cold_chain_at_risk);
  const n_highprio = normalize(ia.high_priority_affected, ib.high_priority_affected);

  const radarData = [
    { subject: 'Affected', A: n_affected.a, B: n_affected.b },
    { subject: 'Avg Delay', A: n_delay.a, B: n_delay.b },
    { subject: 'Cargo Value', A: n_value.a, B: n_value.b },
    { subject: 'Cold Chain', A: n_coldchain.a, B: n_coldchain.b },
    { subject: 'High Priority', A: n_highprio.a, B: n_highprio.b },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-sm font-semibold text-slate-200">Multi-Dimension Impact Radar</h3>
        <p className="text-xs text-slate-500 mt-0.5">Relative severity across impact dimensions (normalized to worst case = 100)</p>
      </div>
      <div className="card-body flex justify-center">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Radar name={labelA.length > 20 ? labelA.slice(0, 20) + '…' : labelA}
              dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
            <Radar name={labelB.length > 20 ? labelB.slice(0, 20) + '…' : labelB}
              dataKey="B" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} strokeWidth={2} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Tooltip {...DARK_TOOLTIP} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Scenario Result Card ──────────────────────────────────────────────────────

function ScenarioResultCard({ scenario, label, colorIdx, isWorst, isBest }: {
  scenario: WhatIfResult['scenarios'][0];
  label: string;
  colorIdx: number;
  isWorst: boolean;
  isBest: boolean;
}) {
  const imp = scenario.impact_summary;
  const rec = scenario.recommended_strategy;
  const COLORS = ['border-blue-600', 'border-purple-600', 'border-orange-600', 'border-pink-600'];
  const HEADER_COLORS = ['bg-blue-900/20', 'bg-purple-900/20', 'bg-orange-900/20', 'bg-pink-900/20'];
  const BADGE_COLORS = ['text-blue-300', 'text-purple-300', 'text-orange-300', 'text-pink-300'];

  return (
    <div className={`card border-2 ${isWorst ? 'border-red-700' : isBest ? 'border-green-700' : COLORS[colorIdx % COLORS.length]}`}>
      <div className={`card-header ${isWorst ? 'bg-red-900/20' : isBest ? 'bg-green-900/20' : HEADER_COLORS[colorIdx % HEADER_COLORS.length]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
              colorIdx === 0 ? 'bg-blue-600' : colorIdx === 1 ? 'bg-purple-600' : colorIdx === 2 ? 'bg-orange-600' : 'bg-pink-600'
            }`}>{colorIdx + 1}</span>
            <span className={`text-xs font-semibold truncate ${BADGE_COLORS[colorIdx % BADGE_COLORS.length]}`} title={label}>
              {label}
            </span>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {isWorst && <span className="badge badge-critical text-xs">Worst</span>}
            {isBest && <span className="badge badge-low text-xs">Best</span>}
          </div>
        </div>
      </div>
      <div className="card-body space-y-2">
        <MetricLine label="Affected" value={`${imp.total_affected_shipments} shipments`} />
        <MetricLine label="Avg Delay" value={formatDelay(imp.average_delay_hours)} highlight />
        <MetricLine label="Cargo Exposed" value={formatCurrency(imp.total_cargo_value_exposed)} />
        <MetricLine label="Cold Chain" value={`${imp.cold_chain_at_risk} at risk`} />
        <MetricLine label="High Priority" value={`${imp.high_priority_affected} affected`} />
        {rec && (
          <div className="pt-2 border-t border-slate-700">
            <p className="text-xs text-slate-500">Recommended strategy:</p>
            <p className="text-xs text-white font-medium capitalize mt-0.5">{rec.strategy_type}</p>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-slate-400">{formatCurrency(rec.additional_cost_inr)}</span>
              <span className="text-xs text-slate-400">{formatDelay(rec.average_delay_hours)}</span>
              <span className={`text-xs capitalize ${
                rec.risk_level === 'high' || rec.risk_level === 'critical' ? 'text-red-400' : 'text-green-400'
              }`}>{rec.risk_level} risk</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricLine({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className={`font-medium text-xs ${highlight ? 'text-orange-300' : 'text-white'}`}>{value}</span>
    </div>
  );
}

// ── What-If Delta Summary Card ─────────────────────────────────────────────────
function WhatIfDeltaCard({
  label, best, worst, delta, bestLabel, worstLabel,
}: {
  label: string;
  best: string;
  worst: string;
  delta: string;
  bestLabel: string;
  worstLabel: string;
}) {
  const isNoChange = delta === '+0' || delta === '+0h' || delta === '=';
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">{label}</div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-green-400 truncate max-w-20" title={bestLabel}>Best</span>
          <span className="text-sm font-bold text-green-400">{best}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-red-400 truncate max-w-20" title={worstLabel}>Worst</span>
          <span className="text-sm font-bold text-red-400">{worst}</span>
        </div>
        <div className={`text-center py-1 rounded-lg text-xs font-bold mt-1 ${
          isNoChange
            ? 'bg-slate-700 text-slate-400'
            : 'bg-red-900/30 border border-red-700/50 text-red-300'
        }`}>
          {isNoChange ? 'No difference' : `Delta: ${delta}`}
        </div>
      </div>
    </div>
  );
}
