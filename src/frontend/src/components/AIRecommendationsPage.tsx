import { useState, useEffect } from 'react';
import { getSimulations, getSimulation, type SimulationSummary, type SimulationResult } from '../services/api';
import { formatCurrency, formatDelay } from '../utils/format';
import StrategyCards from './StrategyCards';
import ExplainableAI from './ExplainableAI';
import {
  BrainCircuit, RefreshCw, Zap, ChevronRight, Clock,
  MapPin, Shield, TrendingUp, Package, AlertTriangle,
} from 'lucide-react';

export default function AIRecommendationsPage() {
  const [sims, setSims] = useState<SimulationSummary[]>([]);
  const [selected, setSelected] = useState<SimulationSummary | null>(null);
  const [detail, setDetail] = useState<SimulationResult | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadList = async () => {
    setLoadingList(true);
    try {
      const data = await getSimulations();
      const withStrategy = data.filter(s => s.recommended_strategy && s.status === 'completed');
      setSims(withStrategy);
    } catch {
      setSims([]);
    } finally {
      setLoadingList(false);
    }
  };

  const loadDetail = async (sim: SimulationSummary) => {
    setSelected(sim);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const d = await getSimulation(sim.simulation_id);
      setDetail(d?.data ?? d);
    } catch {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => { loadList(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-blue-600" />
            AI Recommendations
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Recovery strategies and AI-generated explanations from crisis simulations
          </p>
        </div>
        <button onClick={loadList} className="btn-secondary flex items-center gap-2 text-sm" disabled={loadingList}>
          <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* MONITOR → INVESTIGATE → ANALYZE → DECIDE → ACT flow */}
      <div className="card">
        <div className="card-body py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            {['Monitor', 'Investigate', 'Analyze', 'Decide', 'Act'].map((step, i) => (
              <div key={step} className="flex items-center gap-2 flex-shrink-0">
                <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold border ${
                  i === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  i === 1 ? 'bg-blue-50    border-blue-200    text-blue-700' :
                  i === 2 ? 'bg-violet-50  border-violet-200  text-violet-700' :
                  i === 3 ? 'bg-amber-50   border-amber-200   text-amber-700' :
                            'bg-red-50     border-red-200     text-red-700'
                }`}>
                  {step}
                </div>
                {i < 4 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Simulation list with recommendations */}
        <div className="w-72 flex-shrink-0 card overflow-hidden">
          <div className="card-header py-3">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Simulations with AI Strategy
            </h3>
          </div>
          {loadingList ? (
            <div className="flex items-center justify-center py-10"><div className="loading-spinner" /></div>
          ) : sims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-slate-500 text-center">
              <Zap className="w-8 h-8 mb-2 opacity-50 text-slate-400" />
              <p className="text-sm">No simulations with recommendations yet</p>
              <p className="text-xs mt-1">Run the Crisis Simulator to generate AI recommendations</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[calc(100vh-280px)]">
              {sims.map(sim => {
                const isSelected = selected?.simulation_id === sim.simulation_id;
                return (
                  <button
                    key={sim.simulation_id}
                    onClick={() => loadDetail(sim)}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                      isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'border-l-2 border-transparent'
                    }`}
                  >
                    <Shield className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-800 font-medium truncate mb-0.5">
                        {sim.scenario_name || sim.location}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{sim.location}</span>
                        <span className="text-blue-400 capitalize font-medium">{sim.recommended_strategy?.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {sim.created_at ? new Date(sim.created_at).toLocaleDateString('en-IN') : '—'}
                      </div>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isSelected ? 'text-blue-400' : 'text-slate-600'}`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0 space-y-4">
          {!selected ? (
            <div className="card flex items-center justify-center" style={{ minHeight: 320 }}>
              <div className="text-center text-slate-500 p-8">
                <BrainCircuit className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Select a simulation</p>
                <p className="text-xs mt-1">View AI strategies and explanations</p>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="card flex items-center justify-center" style={{ minHeight: 320 }}>
              <div className="text-center">
                <div className="loading-spinner mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Loading AI analysis…</p>
              </div>
            </div>
          ) : detail ? (
            <>
              {/* Summary header */}
              <div className="card">
                <div className="card-body py-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-slate-900">
                        {selected.scenario_name || selected.location}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{detail.scenario?.location ?? selected.location}
                        </span>
                        <span className="capitalize">{detail.scenario?.disruption_type?.replace(/_/g, ' ') ?? selected.disruption_type.replace(/_/g, ' ')}</span>
                        <span className="capitalize">{detail.scenario?.severity ?? selected.severity} severity</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Recommended</div>
                      <div className="text-sm text-blue-600 font-semibold capitalize mt-0.5">
                        {detail.recommended_strategy?.name ?? selected.recommended_strategy?.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <MetricCard label="Affected Shipments" value={String(detail.impact_summary?.total_affected_shipments ?? selected.total_affected_shipments)} icon={<Package className="w-3.5 h-3.5 text-amber-400" />} />
                    <MetricCard label="Cargo Exposed" value={formatCurrency(detail.impact_summary?.total_cargo_value_exposed ?? selected.total_cargo_value_exposed)} icon={<AlertTriangle className="w-3.5 h-3.5 text-red-400" />} />
                    <MetricCard label="Avg Delay" value={formatDelay(detail.impact_summary?.average_delay_hours ?? selected.average_delay_hours)} icon={<Clock className="w-3.5 h-3.5 text-blue-400" />} />
                  </div>
                </div>
              </div>

              {/* Strategies */}
              {detail.strategies && detail.strategies.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-gray-800">Recovery Strategies</h3>
                  </div>
                  <StrategyCards strategies={detail.strategies} />
                </div>
              )}

              {/* AI Explanation */}
              {detail.explanation && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <BrainCircuit className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-gray-800">AI Explanation</h3>
                  </div>
                  <ExplainableAI
                    explanation={detail.explanation}
                    simulationContext={{
                      disruption_type: detail.scenario?.disruption_type,
                      location: detail.scenario?.location,
                      severity: detail.scenario?.severity,
                      duration_hours: detail.scenario?.duration_hours,
                      total_affected_shipments: detail.impact_summary?.total_affected_shipments,
                      average_delay_hours: detail.impact_summary?.average_delay_hours,
                      cold_chain_at_risk: detail.impact_summary?.cold_chain_at_risk,
                      high_priority_affected: detail.impact_summary?.high_priority_affected,
                      disrupted_routes: detail.impact_summary?.disrupted_routes,
                      recommended_strategy: detail.recommended_strategy?.strategy_type,
                      strategy_name: detail.recommended_strategy?.name,
                    }}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="card flex items-center justify-center" style={{ minHeight: 200 }}>
              <p className="text-slate-500 text-sm">Could not load simulation details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[11px] text-slate-500">{label}</span>
      </div>
      <div className="text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}
