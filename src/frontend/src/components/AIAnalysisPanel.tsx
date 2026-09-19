/**
 * AIAnalysisPanel — Structured AI recommendation view
 * Wraps real StrategyCards + ExplainableAI components.
 * Shows the full PROBLEM → IMPACT → RECOMMENDATION → ACTION flow.
 * Only displays data returned by the actual backend — no fabricated values.
 */

import { useState, useEffect } from 'react';
import type { SimulationResult, SimulationSummary } from '../services/api';
import { getSimulation } from '../services/api';
import { formatCurrency, formatDelay, disruption_label } from '../utils/format';
import StrategyCards from './StrategyCards';
import ExplainableAI from './ExplainableAI';
import {
  BrainCircuit, AlertTriangle, TrendingUp, CheckCircle2,
  Loader2, ArrowDown, Zap, Package,
} from 'lucide-react';

interface AIAnalysisPanelProps {
  simulation: SimulationSummary;
  onNavigate: (section: string) => void;
  onClose: () => void;
}

export default function AIAnalysisPanel({
  simulation,
  onNavigate,
  onClose,
}: AIAnalysisPanelProps) {
  const [detail, setDetail] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSimulation(simulation.simulation_id)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(e => { if (!cancelled) setError(e.message ?? 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [simulation.simulation_id]);

  return (
    <div className="space-y-0">
      {/* Header strip */}
      <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
        <BrainCircuit className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-blue-900">ChainMind AI Analysis</span>
        {detail?.explanation?.used_llm && (
          <span className="ml-auto text-[10px] bg-blue-100 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
            {detail.explanation.llm_provider?.toUpperCase() ?? 'AI-POWERED'}
          </span>
        )}
      </div>

      <div className="px-5 py-4 space-y-5">
        {loading && (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading AI analysis…
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            {error}
          </div>
        )}

        {detail && !loading && (
          <>
            {/* ① Problem detected */}
            <FlowStep
              step={1}
              icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
              title="Problem Detected"
              color="red"
            >
              <div className="text-sm text-slate-700">
                <span className="font-medium">{disruption_label(detail.scenario.disruption_type)}</span>
                {' at '}
                <span className="font-medium">{detail.scenario.location}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`text-xs font-semibold border rounded px-2 py-0.5 capitalize ${
                  detail.scenario.severity === 'high'   ? 'bg-red-50 text-red-700 border-red-200' :
                  detail.scenario.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                          'bg-green-50 text-green-700 border-green-200'
                }`}>
                  {detail.scenario.severity} severity
                </span>
                <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 rounded px-2 py-0.5">
                  {detail.scenario.duration_hours}h duration
                </span>
              </div>
            </FlowStep>

            <StepConnector />

            {/* ② Potential impact */}
            <FlowStep
              step={2}
              icon={<TrendingUp className="w-4 h-4 text-amber-500" />}
              title="Potential Impact"
              color="amber"
            >
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                  <div className="text-amber-600 font-medium mb-0.5">Affected Shipments</div>
                  <div className="text-lg font-bold text-amber-800">{detail.impact_summary.total_affected_shipments}</div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                  <div className="text-amber-600 font-medium mb-0.5">Average Delay</div>
                  <div className="text-lg font-bold text-amber-800">{formatDelay(detail.impact_summary.average_delay_hours)}</div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                  <div className="text-slate-500 font-medium mb-0.5">Cargo Exposed</div>
                  <div className="text-sm font-semibold text-slate-800">{formatCurrency(detail.impact_summary.total_cargo_value_exposed)}</div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                  <div className="text-slate-500 font-medium mb-0.5">Disrupted Routes</div>
                  <div className="text-sm font-semibold text-slate-800">{detail.impact_summary.disrupted_routes}</div>
                </div>
                {detail.impact_summary.cold_chain_at_risk > 0 && (
                  <div className="col-span-2 bg-cyan-50 border border-cyan-100 rounded-lg p-2.5">
                    <div className="text-cyan-600 font-medium mb-0.5">Cold Chain at Risk</div>
                    <div className="text-sm font-semibold text-cyan-800">{detail.impact_summary.cold_chain_at_risk} temperature-sensitive shipments</div>
                  </div>
                )}
              </div>
            </FlowStep>

            <StepConnector />

            {/* ③ Recommended response */}
            <FlowStep
              step={3}
              icon={<BrainCircuit className="w-4 h-4 text-blue-500" />}
              title="Recommended Response"
              color="blue"
            >
              {detail.recommended_strategy ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="text-sm font-semibold text-blue-900 mb-1">
                    {detail.recommended_strategy.name}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                    <div>
                      <span className="text-blue-500 font-medium block">Est. Delay</span>
                      <span className="text-blue-900 font-semibold">
                        {formatDelay(detail.recommended_strategy.average_delay_hours)}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-500 font-medium block">Additional Cost</span>
                      <span className="text-blue-900 font-semibold">
                        {formatCurrency(detail.recommended_strategy.additional_cost_inr)}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-500 font-medium block">Risk Level</span>
                      <span className={`font-semibold capitalize ${
                        detail.recommended_strategy.risk_level === 'high' ? 'text-red-700' :
                        detail.recommended_strategy.risk_level === 'medium' ? 'text-amber-700' :
                        'text-green-700'
                      }`}>
                        {detail.recommended_strategy.risk_level}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No strategy recommendation available for this simulation.</p>
              )}
            </FlowStep>

            <StepConnector />

            {/* ④ Expected outcome */}
            <FlowStep
              step={4}
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              title="Expected Outcome"
              color="green"
            >
              {detail.explanation?.explanation ? (
                <p className="text-sm text-slate-700 leading-relaxed">
                  {detail.explanation.crisis_summary ?? detail.explanation.explanation}
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  Apply the recommended strategy to reduce cascade impact across{' '}
                  {detail.impact_summary.disrupted_routes} disrupted routes.
                </p>
              )}
            </FlowStep>

            {/* Detailed strategy cards */}
            {detail.strategies.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  All Recovery Strategies ({detail.strategies.length})
                </div>
                <StrategyCards strategies={detail.strategies} />
              </div>
            )}

            {/* Full AI explanation */}
            {detail.explanation && (
              <div className="border-t border-slate-100 pt-4">
                <ExplainableAI
                  explanation={detail.explanation}
                  simulationContext={{
                    disruption_type: detail.scenario.disruption_type,
                    location: detail.scenario.location,
                    severity: detail.scenario.severity,
                    duration_hours: detail.scenario.duration_hours,
                    total_affected_shipments: detail.impact_summary.total_affected_shipments,
                    average_delay_hours: detail.impact_summary.average_delay_hours,
                    cold_chain_at_risk: detail.impact_summary.cold_chain_at_risk,
                    high_priority_affected: detail.impact_summary.high_priority_affected,
                    disrupted_routes: detail.impact_summary.disrupted_routes,
                    recommended_strategy: detail.recommended_strategy?.strategy_type,
                    strategy_name: detail.recommended_strategy?.name,
                  }}
                />
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-slate-100 pt-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Next Steps</div>
              <div className="space-y-2">
                <button
                  onClick={() => { onNavigate('ai-recommendations'); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors text-left shadow-sm"
                >
                  <BrainCircuit className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">Open Full AI Recommendations</div>
                    <div className="text-xs text-blue-200">Compare all strategy options in detail</div>
                  </div>
                </button>
                <button
                  onClick={() => { onNavigate('crisis-simulator'); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                >
                  <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Run New Crisis Simulation</div>
                    <div className="text-xs text-slate-400">Test different scenarios</div>
                  </div>
                </button>
                <button
                  onClick={() => { onNavigate('shipments'); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                >
                  <Package className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div>
                    <div className="font-medium">View Affected Shipments</div>
                    <div className="text-xs text-slate-400">{detail.impact_summary.total_affected_shipments} shipments impacted</div>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FlowStep({
  step, icon, title, color, children,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  color: 'red' | 'amber' | 'blue' | 'green';
  children: React.ReactNode;
}) {
  const borderCls = {
    red:   'border-red-200',
    amber: 'border-amber-200',
    blue:  'border-blue-200',
    green: 'border-emerald-200',
  }[color];
  const numCls = {
    red:   'bg-red-50 text-red-600 border-red-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    blue:  'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  }[color];

  return (
    <div className={`rounded-xl border p-4 ${borderCls} bg-white`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-5 h-5 rounded-full border text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${numCls}`}>
          {step}
        </span>
        {icon}
        <span className="text-sm font-semibold text-slate-800">{title}</span>
      </div>
      {children}
    </div>
  );
}

function StepConnector() {
  return (
    <div className="flex justify-center">
      <ArrowDown className="w-4 h-4 text-slate-300" />
    </div>
  );
}
