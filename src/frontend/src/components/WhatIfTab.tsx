import { useState } from 'react';
import type { SimulationRequest, WhatIfResult } from '../services/api';
import { runWhatIf } from '../services/api';
import { formatCurrency, formatDelay } from '../utils/format';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { GitCompare, Plus, Trash2, Loader2, TrendingUp } from 'lucide-react';

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

interface WhatIfTabProps {
}

const DEFAULT_SCENARIOS: SimulationRequest[] = [
  { disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 72, severity: 'high', capacity_reduction: 1.0 },
  { disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 120, severity: 'high', capacity_reduction: 1.0 },
];

export default function WhatIfTab(_props: WhatIfTabProps) {
  const [scenarios, setScenarios] = useState<SimulationRequest[]>(DEFAULT_SCENARIOS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WhatIfResult | null>(null);

  const addScenario = () => {
    if (scenarios.length < 5) {
      setScenarios([...scenarios, { disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 48, severity: 'medium', capacity_reduction: 0.8 }]);
    }
  };

  const removeScenario = (idx: number) => {
    if (scenarios.length > 2) setScenarios(scenarios.filter((_, i) => i !== idx));
  };

  const updateScenario = (idx: number, field: keyof SimulationRequest, value: string | number) => {
    setScenarios(scenarios.map((s, i) => i === idx ? { ...s, [field]: value } : s));
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
          Compare multiple disruption scenarios side-by-side — the supply-chain time machine
        </p>
      </div>

      {/* Scenario Configuration */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-200">Configure Scenarios</h3>
          </div>
          <button onClick={addScenario} disabled={scenarios.length >= 5} className="btn-secondary flex items-center gap-1 text-xs">
            <Plus className="w-3 h-3" /> Add Scenario
          </button>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((s, idx) => (
              <div key={idx} className="bg-slate-750 border border-slate-600 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">Scenario {idx + 1}</span>
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
                  <label className="label">Duration: {s.duration_hours}h</label>
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
                            : 'bg-slate-700 text-slate-400'
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
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Running Comparison...</>
              : <><GitCompare className="w-4 h-4" />Compare Scenarios</>}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Comparison Banner */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-semibold text-blue-300">Comparison Results</h3>
              <span className="text-xs text-slate-400">
                {result.comparison.scenario_labels.length} scenarios compared
              </span>
            </div>
            {result.comparison.delay_increase_pct > 0 && (
              <p className="text-sm text-slate-300">
                Worst scenario is <strong className="text-red-400">{result.comparison.delay_increase_pct}%</strong> more
                delayed than the best scenario.
              </p>
            )}
          </div>

          {/* Metrics Comparison Chart */}
          <ComparisonCharts comparison={result.comparison} />

          {/* Side-by-side Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.scenarios.map((scenario, idx) => (
              <ScenarioResultCard
                key={scenario.simulation_id}
                scenario={scenario}
                label={result.comparison.scenario_labels[idx]}
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

function ComparisonCharts({ comparison }: { comparison: WhatIfResult['comparison'] }) {
  const affected = comparison.metrics['total_affected_shipments'] ?? [];
  const delays = comparison.metrics['average_delay_hours'] ?? [];
  const values = comparison.metrics['total_cargo_value_exposed'] ?? [];

  const chartData = comparison.scenario_labels.map((label, i) => ({
    label: label.length > 20 ? label.substring(0, 20) + '…' : label,
    affected: affected[i] ?? 0,
    delay: Math.round((delays[i] ?? 0) * 10) / 10,
    value: Math.round((values[i] ?? 0) / 1_00_000),
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="card">
        <div className="card-header"><h3 className="text-sm font-semibold text-slate-200">Affected Shipments</h3></div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ left: -10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip {...DARK_TOOLTIP} />
              <Bar dataKey="affected" name="Shipments" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><h3 className="text-sm font-semibold text-slate-200">Average Delay (hours)</h3></div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ left: -10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip {...DARK_TOOLTIP} />
              <Bar dataKey="delay" name="Delay (h)" fill="#f97316" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><h3 className="text-sm font-semibold text-slate-200">Cargo Exposed (₹L)</h3></div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ left: -10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip {...DARK_TOOLTIP} />
              <Bar dataKey="value" name="Value (₹L)" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ScenarioResultCard({ scenario, label, isWorst, isBest }: {
  scenario: WhatIfResult['scenarios'][0];
  label: string;
  isWorst: boolean;
  isBest: boolean;
}) {
  const imp = scenario.impact_summary;
  const rec = scenario.recommended_strategy;

  return (
    <div className={`card border-2 ${isWorst ? 'border-red-700' : isBest ? 'border-green-700' : 'border-slate-700'}`}>
      <div className={`card-header ${isWorst ? 'bg-red-900/20' : isBest ? 'bg-green-900/20' : ''}`}>
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-200 truncate">{label}</h4>
          {isWorst && <span className="badge badge-critical text-xs ml-2 flex-shrink-0">Worst</span>}
          {isBest && <span className="badge badge-low text-xs ml-2 flex-shrink-0">Best</span>}
        </div>
      </div>
      <div className="card-body space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Affected</span>
          <span className="text-white font-medium">{imp.total_affected_shipments}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Avg Delay</span>
          <span className="text-white font-medium">{formatDelay(imp.average_delay_hours)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Cargo Exposed</span>
          <span className="text-white font-medium">{formatCurrency(imp.total_cargo_value_exposed)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Cold Chain</span>
          <span className="text-cyan-400">{imp.cold_chain_at_risk}</span>
        </div>
        {rec && (
          <div className="pt-2 border-t border-slate-700">
            <p className="text-xs text-slate-400">Recommended: <span className="text-blue-400 capitalize">{rec.strategy_type}</span></p>
            <p className="text-xs text-slate-400">Recovery: {formatCurrency(rec.additional_cost_inr)} · {formatDelay(rec.average_delay_hours)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
