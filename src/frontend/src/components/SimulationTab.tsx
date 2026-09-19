import { useState, useRef } from 'react';
import type { Port, SimulationResult, SimulationRequest, FleetVehicle } from '../services/api';
import { runSimulation } from '../services/api';
import { formatCurrency, formatDelay, disruption_label } from '../utils/format';
import DigitalTwin from './DigitalTwin';
import ImpactSummaryPanel from './ImpactSummaryPanel';
import StrategyCards from './StrategyCards';
import ExplainableAI from './ExplainableAI';
import ColdChainPanel from './ColdChainPanel';
import FleetAvailabilityPanel from './FleetAvailabilityPanel';
import AffectedRoutesPanel from './AffectedRoutesPanel';
import ScenarioCompareBanner from './ScenarioCompareBanner';
import RiskCharts from './charts/RiskCharts';
import {
  Zap, AlertTriangle, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Package, RotateCcw, History, ArrowLeft, BrainCircuit,
} from 'lucide-react';

const DISRUPTION_TYPES = [
  { value: 'port_closure',         label: 'Port Closure' },
  { value: 'route_closure',        label: 'Route Closure' },
  { value: 'severe_weather',       label: 'Severe Weather' },
  { value: 'strike',               label: 'Strike / Labour Disruption' },
  { value: 'vehicle_shortage',     label: 'Vehicle Shortage' },
  { value: 'fuel_price_increase',  label: 'Fuel Price Increase' },
  { value: 'demand_spike',         label: 'Demand Spike' },
  { value: 'warehouse_disruption', label: 'Warehouse Disruption' },
];

const LOCATIONS = [
  { value: 'Mumbai Port',    label: 'Mumbai Port' },
  { value: 'JNPT',           label: 'JNPT (Nhava Sheva)' },
  { value: 'Mundra',         label: 'Mundra Port' },
  { value: 'Chennai',        label: 'Chennai Port' },
  { value: 'Kolkata',        label: 'Kolkata Port' },
  { value: 'Kochi',          label: 'Kochi Port' },
  { value: 'Visakhapatnam',  label: 'Visakhapatnam Port' },
  { value: 'Kandla',         label: 'Kandla Port' },
  { value: 'Delhi',          label: 'Delhi NCR Hub' },
  { value: 'Ahmedabad',      label: 'Ahmedabad Hub' },
  { value: 'Bengaluru',      label: 'Bengaluru Hub' },
  { value: 'Hyderabad',      label: 'Hyderabad Hub' },
  { value: 'Pune',           label: 'Pune Hub' },
];

const DEMO_PRESETS: Array<{ label: string; scenario: SimulationRequest }> = [
  {
    label: 'Mumbai 72h ⚡',
    scenario: { disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 72, severity: 'high', capacity_reduction: 1.0 },
  },
  {
    label: 'Mumbai 120h ⚡',
    scenario: { disruption_type: 'port_closure', location: 'Mumbai Port', duration_hours: 120, severity: 'high', capacity_reduction: 1.0 },
  },
  {
    label: 'Chennai Storm',
    scenario: { disruption_type: 'severe_weather', location: 'Chennai', duration_hours: 48, severity: 'medium', capacity_reduction: 0.6 },
  },
  {
    label: 'JNPT Strike',
    scenario: { disruption_type: 'strike', location: 'JNPT', duration_hours: 96, severity: 'high', capacity_reduction: 0.8 },
  },
];

interface SimulationTabProps {
  ports: Port[];
  onSimulationComplete: () => void;
  onNavigate?: (section: string) => void;
}

export default function SimulationTab({ ports, onSimulationComplete, onNavigate }: SimulationTabProps) {
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
  const [previousResult, setPreviousResult] = useState<SimulationResult | null>(null);
  const [showRawShipments, setShowRawShipments] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    // Preserve previous result for comparison
    if (result) setPreviousResult(result);
    try {
      const res = await runSimulation(form);
      setResult(res);
      onSimulationComplete();
      // Scroll to results after a brief delay
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePreset = (preset: SimulationRequest) => {
    setForm(preset);
  };

  const handleReset = () => {
    setResult(null);
    setPreviousResult(null);
    setError(null);
  };

  const hasPrevious = !!(previousResult && result &&
    (previousResult.scenario.duration_hours !== result.scenario.duration_hours ||
     previousResult.scenario.location !== result.scenario.location ||
     previousResult.scenario.severity !== result.scenario.severity ||
     previousResult.scenario.disruption_type !== result.scenario.disruption_type));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Crisis Simulation</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Configure a disruption scenario and simulate cascading supply chain impact in real-time
          </p>
        </div>
        {result && (
          <button onClick={handleReset} className="btn-secondary flex items-center gap-2 text-sm">
            <RotateCcw className="w-4 h-4" />
            Clear Results
          </button>
        )}
      </div>

      {/* Main layout: scenario panel + map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Scenario Configuration Panel ──────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-800">Scenario Configuration</h3>
              {result && (
                <span className="ml-auto text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Run #{result.simulation_id.slice(-4)}
                </span>
              )}
            </div>
            <div className="card-body space-y-4">

              {/* Disruption Type */}
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

              {/* Location */}
              <div>
                <label className="label">Affected Location</label>
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

              {/* Duration slider */}
              <div>
                <label className="label">
                  Duration: <strong className="text-slate-800">{form.duration_hours}h</strong>
                  <span className="text-slate-500 ml-1">({(form.duration_hours / 24).toFixed(1)} days)</span>
                </label>
                <input
                  type="range"
                  min={6}
                  max={240}
                  step={6}
                  value={form.duration_hours}
                  onChange={e => setForm(f => ({ ...f, duration_hours: Number(e.target.value) }))}
                  className="w-full accent-blue-500 mt-1"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-0.5">
                  <span>6h</span><span>120h</span><span>240h</span>
                </div>
              </div>

              {/* Severity toggle */}
              <div>
                <label className="label">Severity</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map(sev => (
                    <button
                      key={sev}
                      onClick={() => setForm(f => ({ ...f, severity: sev }))}
                      className={`py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                        form.severity === sev
                          ? sev === 'high'   ? 'bg-red-600 text-white ring-2 ring-red-300'
                          : sev === 'medium' ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                          :                   'bg-green-600 text-white ring-2 ring-green-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Capacity blocked */}
              <div>
                <label className="label">
                  Capacity Blocked: <strong className="text-slate-800">{Math.round((form.capacity_reduction ?? 1) * 100)}%</strong>
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
                <div className="flex justify-between text-xs text-slate-600">
                  <span>10%</span><span>50%</span><span>100%</span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs">
                  <strong>Error:</strong> {error}
                </div>
              )}

              {/* Run Button */}
              <button
                onClick={handleRun}
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Simulating cascading impact...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    {result ? 'Re-run Simulation' : 'Run Crisis Simulation'}
                  </>
                )}
              </button>

              {/* Re-run hint */}
              {result && (
                <p className="text-xs text-slate-500 text-center">
                  <RefreshCw className="w-3 h-3 inline mr-1" />
                  Change any parameter above and re-run to compare
                </p>
              )}
            </div>
          </div>

          {/* Demo Presets */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-600">Demo Presets</span>
            </div>
            <div className="card-body pt-3 pb-4 grid grid-cols-2 gap-2">
              {DEMO_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset.scenario)}
                  className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-lg text-slate-700 transition-colors text-left"
                >
                  {preset.label}
                  <div className="text-slate-400 text-xs mt-0.5">
                    {preset.scenario.duration_hours}h · {preset.scenario.severity}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Digital Twin ──────────────────────────────────── */}
        <div className="lg:col-span-2">
          <DigitalTwin
            refreshTrigger={result ? Date.now() : 0}
            disruptedRouteIds={result?.disrupted_route_ids ?? []}
            activeLocation={result?.scenario?.location ?? form.location}
            compact={true}
          />
          {/* Run hint when no result */}
          {!result && !loading && (
            <div className="mt-3 text-center text-xs text-slate-500">
              Configure a scenario and click <strong className="text-slate-700">Run Crisis Simulation</strong> to see disruption impact on the digital twin
            </div>
          )}
          {loading && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-blue-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Calculating cascading impact across {ports.length} ports and the route network...
            </div>
          )}
        </div>
      </div>

      {/* ── Results Section ───────────────────────────────── */}
      {result && (
        <div ref={resultsRef} className="space-y-6">

          {/* ① Scenario comparison banner (appears after 2nd run with different params) */}
          {hasPrevious && previousResult && (
            <ScenarioCompareBanner previous={previousResult} current={result} />
          )}

          {/* ② Disruption impact header */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <h3 className="text-base font-semibold text-red-800 flex-1">
                {disruption_label(result.scenario.disruption_type)} Impact — {result.scenario.location}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge capitalize text-xs ${
                  result.scenario.severity === 'high' ? 'badge-critical' :
                  result.scenario.severity === 'medium' ? 'badge-high' : 'badge-medium'
                }`}>
                  {result.scenario.severity} severity
                </span>
                <span className="badge badge-high text-xs">
                  {result.scenario.duration_hours}h duration
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ID: {result.simulation_id.slice(-8)}
                </span>
              </div>
            </div>
            <ImpactSummaryPanel impact={result.impact_summary} />
          </div>

          {/* ③ Charts row */}
          <RiskCharts
            riskDistribution={result.risk_distribution}
            delayDistribution={result.delay_distribution}
            strategies={result.strategies}
          />

          {/* ④ Affected routes + Fleet (side by side on wide screens) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <AffectedRoutesPanel
              disruptedRouteIds={result.disrupted_route_ids}
              disruptedLocation={result.scenario.location}
              disrupted_routes_count={result.impact_summary.disrupted_routes}
            />
            <FleetAvailabilityPanel
              fleetSummary={result.fleet_summary}
              availableFleet={result.available_fleet as FleetVehicle[]}
              coldChainFleet={result.cold_chain_fleet as FleetVehicle[]}
              fleetRequirements={result.fleet_requirements}
            />
          </div>

          {/* ⑤ Cold-chain risk */}
          <ColdChainPanel
            shipments={result.top_risk_shipments}
            totalAtRisk={result.impact_summary.cold_chain_at_risk}
          />

          {/* ⑥ Strategy comparison */}
          <StrategyCards strategies={result.strategies} />

          {/* ⑦ Explainable AI */}
          {result.explanation && (
            <ExplainableAI
              explanation={result.explanation}
              simulationContext={{
                disruption_type: result.scenario?.disruption_type,
                location: result.scenario?.location,
                severity: result.scenario?.severity,
                duration_hours: result.scenario?.duration_hours,
                total_affected_shipments: result.impact_summary?.total_affected_shipments,
                average_delay_hours: result.impact_summary?.average_delay_hours,
                cold_chain_at_risk: result.impact_summary?.cold_chain_at_risk,
                high_priority_affected: result.impact_summary?.high_priority_affected,
                disrupted_routes: result.impact_summary?.disrupted_routes,
                recommended_strategy: result.recommended_strategy?.strategy_type,
                strategy_name: result.recommended_strategy?.name,
              }}
            />
          )}

          {/* ⑦ᵦ Post-simulation CTAs */}
          {onNavigate && (
            <div className="flex flex-wrap items-center gap-3 p-5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">Simulation complete — what next?</p>
                <p className="text-xs text-slate-500 mt-0.5">Review AI recommendations or return to the overview dashboard</p>
              </div>
              <button
                onClick={() => onNavigate('ai-recommendations')}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
              >
                <BrainCircuit className="w-4 h-4" />
                View AI Recommendations
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

          {/* ⑧ Top risk shipments table */}
          {result.top_risk_shipments.length > 0 && (
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-red-500" />
                  <h3 className="text-sm font-semibold text-slate-800">
                    Top Risk Shipments
                  </h3>
                  <span className="badge badge-high text-xs">
                    {result.top_risk_shipments.length} highest risk
                  </span>
                </div>
                <button
                  onClick={() => setShowRawShipments(v => !v)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  {showRawShipments ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showRawShipments ? 'Show fewer' : 'Show all'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left text-slate-500 font-medium px-5 py-2.5">Shipment ID</th>
                      <th className="text-center text-slate-500 font-medium px-4 py-2.5">Risk</th>
                      <th className="text-right text-slate-500 font-medium px-4 py-2.5">Delay</th>
                      <th className="text-right text-slate-500 font-medium px-4 py-2.5">Cargo Value</th>
                      <th className="text-right text-slate-500 font-medium px-4 py-2.5">Cold Chain</th>
                      <th className="text-center text-slate-500 font-medium px-4 py-2.5">Impact Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.top_risk_shipments
                      .slice(0, showRawShipments ? undefined : 10)
                      .map(s => (
                        <tr key={s.shipment_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-2.5 font-mono text-slate-700 text-xs">{s.shipment_id}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`badge capitalize badge-${s.risk_level} text-xs`}>
                              {s.risk_level}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-slate-800 font-medium">{formatDelay(s.delay_hours)}</span>
                            <span className="text-slate-500 text-xs ml-1">({s.delay_hours.toFixed(0)}h)</span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-800">{formatCurrency(s.cargo_value)}</td>
                          <td className="px-4 py-2.5 text-right">
                            {s.cold_chain_risk > 0.1 ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${s.cold_chain_risk > 0.7 ? 'bg-red-500' : s.cold_chain_risk > 0.4 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                                    style={{ width: `${s.cold_chain_risk * 100}%` }}
                                  />
                                </div>
                                <span className="text-cyan-600 text-xs font-medium">{(s.cold_chain_risk * 100).toFixed(0)}%</span>
                              </div>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              s.is_direct
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-orange-50 text-orange-700 border border-orange-200'
                            }`}>
                              {s.is_direct ? 'Direct' : 'Cascade'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!showRawShipments && result.top_risk_shipments.length > 10 && (
                  <div className="text-center py-3 text-xs text-slate-500 border-t border-slate-100">
                    Showing 10 of {result.top_risk_shipments.length} at-risk shipments —
                    <button onClick={() => setShowRawShipments(true)} className="text-blue-600 hover:text-blue-700 ml-1">
                      show all
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
