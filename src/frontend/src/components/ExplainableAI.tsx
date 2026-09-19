/**
 * ExplainableAI — Structured 7-point AI explanation component
 */

import { formatCurrency, formatDelay } from '../utils/format';
import {
  Brain, TrendingDown, Clock, Shield, Package, Truck,
  Info, AlertCircle, AlertTriangle, CheckCircle2, ArrowRight,
  Zap, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

interface ExplanationBasis {
  cost_reasoning?: { value?: number; vs_cheapest?: number; vs_fastest?: number; label?: string };
  delay_reasoning?: { value?: number; vs_cheapest?: number; vs_fastest?: number; label?: string };
  risk_reasoning?: { level?: string; cold_chain_risk?: number; cold_chain_count?: number; label?: string };
  cargo_reasoning?: { total_value?: number; high_priority?: number; label?: string };
  fleet_reasoning?: { vehicles_required?: number; available?: number; label?: string };
}

interface ExplainableAIProps {
  explanation: {
    explanation?: string;
    crisis_summary?: string;
    used_llm?: boolean;
    llm_provider?: string;
    explanation_basis?: ExplanationBasis;
  } | null | undefined;
  simulationContext?: {
    disruption_type?: string;
    location?: string;
    severity?: string;
    duration_hours?: number;
    total_affected_shipments?: number;
    average_delay_hours?: number;
    cold_chain_at_risk?: number;
    high_priority_affected?: number;
    disrupted_routes?: number;
    recommended_strategy?: string;
    strategy_name?: string;
  };
}

function buildNarrativePoints(
  explanation: NonNullable<ExplainableAIProps['explanation']>,
  ctx?: ExplainableAIProps['simulationContext'],
): Array<{ n: number; question: string; answer: string; icon: React.ReactNode; color: string }> {
  const basis = explanation.explanation_basis ?? {};
  const cost = basis.cost_reasoning ?? {};
  const delay = basis.delay_reasoning ?? {};
  const risk = basis.risk_reasoning ?? {};
  const cargo = basis.cargo_reasoning ?? {};
  const fleet = basis.fleet_reasoning ?? {};

  const disruptionType = ctx?.disruption_type?.replace(/_/g, ' ') ?? 'disruption';
  const location = ctx?.location ?? 'the affected area';
  const severity = ctx?.severity ?? 'significant';
  const duration = ctx?.duration_hours ? `${ctx.duration_hours}h` : '';
  const q1answer = `A ${severity} ${disruptionType} occurred at ${location}${duration ? ` lasting ${duration}` : ''}. This event was detected by ChainMind's causal monitoring engine.`;

  const q2answer = explanation.crisis_summary
    || `Conditions at ${location} exceeded safe thresholds, triggering a ${severity}-severity ${disruptionType}. The causal engine identified threshold violations that automatically propagated into network disruptions.`;

  const affected = ctx?.total_affected_shipments ?? 0;
  const routes = ctx?.disrupted_routes ?? 0;
  const coldChain = ctx?.cold_chain_at_risk ?? 0;
  const highPri = ctx?.high_priority_affected ?? 0;
  const cargoVal = cargo.total_value ? formatCurrency(cargo.total_value) : '';
  const q3answer = [
    affected > 0 ? `${affected} shipments directly or indirectly affected` : null,
    routes > 0 ? `${routes} routes disrupted` : null,
    coldChain > 0 ? `${coldChain} cold-chain shipments at temperature risk` : null,
    highPri > 0 ? `${highPri} high-priority (P1/P2) shipments impacted` : null,
    cargoVal ? `${cargoVal} in cargo value exposed` : null,
  ].filter(Boolean).join('. ') || 'Impact analysis completed — no significant disruption detected.';

  const delayHours = ctx?.average_delay_hours ?? delay.value ?? 0;
  const q4answer = delayHours > 0
    ? `Average estimated delay: ${formatDelay(delayHours)}. Risk level: ${(risk.level ?? 'medium').toUpperCase()}. Cold-chain exposure risk: ${((risk.cold_chain_risk ?? 0) * 100).toFixed(0)}% for ${risk.cold_chain_count ?? coldChain} temperature-sensitive shipments.`
    : 'No significant delay impact predicted. Network can absorb this disruption within normal operating parameters.';

  const strategy = ctx?.recommended_strategy ?? ctx?.strategy_name ?? (cost.label ?? 'balanced recovery');
  const fleetNeeded = fleet.vehicles_required ?? 0;
  const fleetAvail = fleet.available ?? 0;
  const q5answer = `ChainMind selected the "${strategy}" recovery strategy. This involves ${fleetNeeded > 0 ? `${fleetNeeded} vehicles from ${fleetAvail} available` : 'existing fleet resources'} to execute the recovery plan.`;

  const costVal = cost.value !== undefined ? formatCurrency(cost.value) : null;
  const costVsFastest = cost.vs_fastest ? formatCurrency(cost.vs_fastest) : null;
  const delayVsCheapest = delay.vs_cheapest ? formatDelay(delay.vs_cheapest) : null;
  const q6answer = explanation.explanation
    || [
      costVal ? `Recovery cost: ${costVal}` : null,
      costVsFastest ? `saves ${costVsFastest} vs fastest option` : null,
      delayVsCheapest ? `reduces delay by ${delayVsCheapest} vs cheapest option` : null,
      `Risk level: ${(risk.level ?? 'medium').toUpperCase()}`,
      'Optimized across: delay (30%), cost (25%), cold-chain risk (25%), overall risk (20%)',
    ].filter(Boolean).join('. ') + '.';

  const q7answer = delayHours > 0
    ? `Expected outcome: shipments resume with an average delay of ${formatDelay(delayHours)}. Cold-chain integrity maintained for ${fleetNeeded > 0 ? 'refrigerated fleet assignments' : 'temperature-sensitive cargo'}. Network returns to normal operation after recovery period.`
    : 'Network is expected to maintain normal operation. No significant recovery actions required.';

  return [
    { n: 1, question: 'What happened?',               answer: q1answer, icon: <AlertTriangle className="w-4 h-4" />, color: '#ef4444' },
    { n: 2, question: 'Why did the crisis happen?',    answer: q2answer, icon: <Zap className="w-4 h-4" />,           color: '#f97316' },
    { n: 3, question: 'What was affected?',            answer: q3answer, icon: <Package className="w-4 h-4" />,       color: '#eab308' },
    { n: 4, question: 'What is the predicted impact?', answer: q4answer, icon: <Clock className="w-4 h-4" />,         color: '#f59e0b' },
    { n: 5, question: 'What recovery action was selected?', answer: q5answer, icon: <ArrowRight className="w-4 h-4" />, color: '#3b82f6' },
    { n: 6, question: 'Why was that action selected?', answer: q6answer, icon: <Brain className="w-4 h-4" />,         color: '#8b5cf6' },
    { n: 7, question: 'What is the expected result?',  answer: q7answer, icon: <CheckCircle2 className="w-4 h-4" />,  color: '#22c55e' },
  ];
}


export default function ExplainableAI({ explanation, simulationContext }: ExplainableAIProps) {
  const [showBasis, setShowBasis] = useState(false);

  if (!explanation) {
    return (
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-500">AI Explanation</h3>
        </div>
        <div className="card-body">
          <p className="text-sm text-gray-400">AI explanation unavailable for this run.</p>
        </div>
      </div>
    );
  }

  const basis = explanation.explanation_basis || {};
  const cost = basis.cost_reasoning || {};
  const delay = basis.delay_reasoning || {};
  const risk = basis.risk_reasoning || {};
  const cargo = basis.cargo_reasoning || {};
  const fleet = basis.fleet_reasoning || {};

  const narrativePoints = buildNarrativePoints(explanation, simulationContext);

  const reasonCards = [
    {
      icon: <TrendingDown className="w-4 h-4 text-green-600" />,
      label: cost.label || 'Recovery cost',
      detail: cost.value !== undefined
        ? `${formatCurrency(cost.value ?? 0)}${(cost.vs_fastest ?? 0) > 0 ? ` · saves ${formatCurrency(cost.vs_fastest ?? 0)} vs fastest` : ''}`
        : 'No recovery cost required.',
      color: 'border-green-200 bg-green-50',
    },
    {
      icon: <Clock className="w-4 h-4 text-amber-600" />,
      label: delay.label || 'Delay reduction',
      detail: delay.value !== undefined
        ? `${formatDelay(delay.value ?? 0)} avg${(delay.vs_cheapest ?? 0) > 0 ? ` · saves ${formatDelay(delay.vs_cheapest ?? 0)} vs cheapest` : ''}`
        : 'No delay impact.',
      color: 'border-amber-200 bg-amber-50',
    },
    {
      icon: <Shield className="w-4 h-4 text-blue-600" />,
      label: risk.label || 'Risk & cold-chain',
      detail: `${(risk.level ?? 'low').toUpperCase()} risk · Cold-chain: ${((risk.cold_chain_risk ?? 0) * 100).toFixed(0)}% for ${risk.cold_chain_count ?? 0} shipments`,
      color: 'border-blue-200 bg-blue-50',
    },
    {
      icon: <Package className="w-4 h-4 text-purple-600" />,
      label: cargo.label || 'Cargo value',
      detail: `${formatCurrency(cargo.total_value ?? 0)} at risk · ${cargo.high_priority ?? 0} high-priority shipments`,
      color: 'border-purple-200 bg-purple-50',
    },
    {
      icon: <Truck className="w-4 h-4 text-orange-600" />,
      label: fleet.label || 'Fleet deployment',
      detail: `${fleet.vehicles_required ?? 0} required · ${fleet.available ?? 0} available`,
      color: 'border-orange-200 bg-orange-50',
    },
  ];

  return (
    <div className="space-y-4">
      {/* 7-Point Narrative */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-800">AI Decision Narrative</h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Info className="w-3 h-3" />
            {explanation.used_llm
              ? <span className="text-blue-600">LLM-enhanced ({explanation.llm_provider})</span>
              : <span>ChainMind deterministic reasoning</span>
            }
          </div>
        </div>
        <div className="card-body space-y-3">
          {narrativePoints.map(pt => (
            <div key={pt.n} className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold"
                style={{ borderColor: pt.color + '66', color: pt.color, background: pt.color + '15' }}>
                {pt.n}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{ color: pt.color }}>{pt.icon}</span>
                  <span className="text-xs font-semibold text-gray-700">{pt.question}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{pt.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decision Basis — collapsible */}
      {explanation.explanation_basis && (
        <div className="card">
          <div
            className="card-header flex items-center justify-between cursor-pointer select-none"
            onClick={() => setShowBasis(v => !v)}
          >
            <h3 className="text-sm font-semibold text-gray-800">Explainable AI — Decision Factors</h3>
            {showBasis
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
          {showBasis && (
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {reasonCards.map((r, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${r.color}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {r.icon}
                      <span className="text-xs font-semibold text-gray-700">{r.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{r.detail}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">
                Scoring weights: 30% delay · 25% cost · 25% cold-chain risk · 20% overall risk
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
