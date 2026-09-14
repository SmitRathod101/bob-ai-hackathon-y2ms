import { useState } from 'react';
import type { Port, SimulationResult, SimulationRequest } from '../services/api';
import { runSimulation } from '../services/api';
import { formatCurrency, formatDelay, disruption_label } from '../utils/format';
import SupplyChainMap from './SupplyChainMap';
import ImpactSummaryPanel from './ImpactSummaryPanel';
import StrategyCards from './StrategyCards';
import ExplainableAI from './ExplainableAI';
import RiskCharts from './charts/RiskCharts';
import { Zap, AlertTriangle, Loader2 } from 'lucide-react';

const DISRUPTION_TYPES = [
  { value: 'port_closure', label: 'Port Closure' },
  { value: 'route_closure', label: 'Route Closure' },
  { value: 'severe_weather', label: 'Severe Weather' },
  { value: 'strike', label: 'Strike / Labour Disruption' },
  { value: 'vehicle_shortage', label: 'Vehicle Shortage' },
  { value: 'fuel_price_increase', label: 'Fuel Price Increase' },
  { value: 'demand_spike', label: 'Demand Spike' },
  { value: 'warehouse_disruption', label: 'Warehouse Disruption' },
];

const LOCATIONS = [
  { value: 'Mumbai Port', label: 'Mumbai Port' },
  { value: 'JNPT', label: 'JNPT (Nhava Sheva)' },
  { value: 'Mundra', label: 'Mundra Port' },
  { value: 'Chennai', label: 'Chennai Port' },
  { value: 'Kolkata', label: 'Kolkata Port' },
  { value: 'Kochi', label: 'Kochi Port' },
  { value: 'Visakhapatnam', label: 'Visakhapatnam Port' },
  { value: 'Kandla', label: 'Kandla Port' },
  { value: 'Delhi', label: 'Delhi NCR Hub' },
  { value: 'Ahmedabad', label: 'Ahmedabad Hub' },
  { value: 'Bengaluru', label: 'Bengaluru Hub' },
  { value: 'Hyderabad', label: 'Hyderabad Hub' },
  { value: 'Pune', label: 'Pune Hub' },
];

interface SimulationTabProps {
  ports: Port[];
  onSimulationComplete: () => void;
}

export default function SimulationTab({ ports, onSimulationComplete }: SimulationTabProps) {
  const [form, setForm] = useState<SimulationRequest>({
    disruption_type: 'port_closure',
    location: 'Mumbai Port',
    duration_hours: 72,
    severity: 'high',
    capacity_reduction: 1.0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runSimulation(form);
      setResult(res);
      onSimulationComplete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Crisis Simulation</h2>
        <p className="text-slate-400 text-sm mt-0.5">Configure a disruption scenario and simulate cascading supply chain impact</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenario Panel */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-semibold text-slate-200">Scenario Configuration</h3>
            </div>
            <div className="card-body space-y-4">
              <div>
                <label className="label">Disruption Type</label>
                <select
                  className="select-field"
                  value={form.disruption_type}
                  onChange={e => setForm(f => ({ ...f, disruption_type: e.target.value }))}
                >
                  {DISRUPTION_TYPES.map(dt => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Location</label>
                <select
                  className="select-field"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                >
                  {LOCATIONS.map(loc => (
                    <option key={loc.value} value={loc.value}>{loc.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Duration: {form.duration_hours} hours ({(form.duration_hours / 24).toFixed(1)} days)</label>
                <input
                  type="range"
                  min={6}
                  max={240}
                  step={6}
                  value={form.duration_hours}
                  onChange={e => setForm(f => ({ ...f, duration_hours: Number(e.target.value) }))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>6h</span><span>120h</span><span>240h</span>
                </div>
              </div>

              <div>
                <label className="label">Severity</label>
                <div className="grid grid-cols-3 gap-2">
                  {['low', 'medium', 'high'].map(sev => (
                    <button
                      key={sev}
                      onClick={() => setForm(f => ({ ...f, severity: sev }))}
                      className={`py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                        form.severity === sev
                          ? sev === 'high' ? 'bg-red-600 text-white'
                            : sev === 'medium' ? 'bg-yellow-600 text-white'
                            : 'bg-green-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">
                  Capacity Blocked: {Math.round((form.capacity_reduction ?? 1) * 100)}%
                </label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={10}
                  value={Math.round((form.capacity_reduction ?? 1) * 100)}
                  onChange={e => setForm(f => ({ ...f, capacity_reduction: Number(e.target.value) / 100 }))}
                  className="w-full accent-blue-500"
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-xs">
                  {error}
                </div>
              )}

              <button
                onClick={handleRun}
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Run Crisis Simulation
                  </>
                )}
              </button>

              {/* Demo preset */}
              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-2">Demo presets:</p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setForm({ disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 72, severity: 'high', capacity_reduction: 1.0 })}
                    className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-300"
                  >
                    Mumbai 72h
                  </button>
                  <button
                    onClick={() => setForm({ disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 120, severity: 'high', capacity_reduction: 1.0 })}
                    className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-300"
                  >
                    Mumbai 120h
                  </button>
                  <button
                    onClick={() => setForm({ disruption_type: 'severe_weather', location: 'Chennai', duration_hours: 48, severity: 'medium', capacity_reduction: 0.6 })}
                    className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-300"
                  >
                    Chennai Storm
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-2">
          <SupplyChainMap
            ports={ports}
            disruptedPortIds={result ? [form.location] : []}
            disruptedRouteIds={result?.disrupted_route_ids ?? []}
            simulationResult={result}
          />
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Impact Banner */}
          <div className="bg-red-900/20 border border-red-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-base font-semibold text-red-300">
                Disruption Impact: {disruption_label(result.scenario.disruption_type)} — {result.scenario.location}
              </h3>
              <span className={`badge text-xs capitalize ${
                result.scenario.severity === 'high' ? 'badge-critical' :
                result.scenario.severity === 'medium' ? 'badge-high' : 'badge-low'
              }`}>
                {result.scenario.severity} severity
              </span>
            </div>
            <ImpactSummaryPanel impact={result.impact_summary} />
          </div>

          {/* Charts Row */}
          <RiskCharts
            riskDistribution={result.risk_distribution}
            delayDistribution={result.delay_distribution}
            strategies={result.strategies}
          />

          {/* Strategy Cards */}
          <StrategyCards strategies={result.strategies} />

          {/* Explainable AI */}
          {result.explanation && (
            <ExplainableAI explanation={result.explanation} />
          )}

          {/* Top Risk Shipments */}
          {result.top_risk_shipments.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-sm font-semibold text-slate-200">Top Risk Shipments</h3>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-400 font-medium px-5 py-2.5">Shipment</th>
                      <th className="text-center text-slate-400 font-medium px-4 py-2.5">Risk</th>
                      <th className="text-right text-slate-400 font-medium px-4 py-2.5">Delay</th>
                      <th className="text-right text-slate-400 font-medium px-4 py-2.5">Cargo Value</th>
                      <th className="text-right text-slate-400 font-medium px-4 py-2.5">Cold Chain</th>
                      <th className="text-center text-slate-400 font-medium px-4 py-2.5">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.top_risk_shipments.slice(0, 10).map(s => (
                      <tr key={s.shipment_id} className="border-b border-slate-800 hover:bg-slate-750">
                        <td className="px-5 py-2.5 font-mono text-slate-300 text-xs">{s.shipment_id}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`badge capitalize badge-${s.risk_level}`}>{s.risk_level}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-300">{formatDelay(s.delay_hours)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-300">{formatCurrency(s.cargo_value)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {s.cold_chain_risk > 0.3
                            ? <span className="text-cyan-400">{(s.cold_chain_risk * 100).toFixed(0)}%</span>
                            : <span className="text-slate-600">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs ${s.is_direct ? 'text-red-400' : 'text-orange-400'}`}>
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
