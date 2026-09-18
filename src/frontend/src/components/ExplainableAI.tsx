import { formatCurrency, formatDelay } from '../utils/format';
import { Brain, TrendingDown, Clock, Shield, Package, Truck, Info, AlertCircle } from 'lucide-react';

// explanation_basis sub-objects are all optional to handle zero-impact and error states
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
}

export default function ExplainableAI({ explanation }: ExplainableAIProps) {
  // Guard: if explanation is null/undefined or fundamentally broken, show a safe fallback
  if (!explanation) {
    return (
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-medium text-slate-400">AI Explanation</h3>
        </div>
        <div className="card-body">
          <p className="text-sm text-slate-500">AI explanation unavailable for this run.</p>
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

  const reasons = [
    {
      icon: <TrendingDown className="w-4 h-4 text-green-400" />,
      label: cost.label || 'Recovery cost analysis',
      detail: cost.value !== undefined
        ? `Recovery cost: ${formatCurrency(cost.value ?? 0)}. ` +
          ((cost.vs_fastest ?? 0) > 0
            ? `Saves ${formatCurrency(cost.vs_fastest ?? 0)} vs fastest option.`
            : `${formatCurrency(Math.abs(cost.vs_cheapest ?? 0))} more than cheapest.`)
        : 'No recovery cost required.',
      color: 'border-green-700/40 bg-green-900/10',
    },
    {
      icon: <Clock className="w-4 h-4 text-yellow-400" />,
      label: delay.label || 'Delay reduction analysis',
      detail: delay.value !== undefined
        ? `Average delay: ${formatDelay(delay.value ?? 0)}. ` +
          ((delay.vs_cheapest ?? 0) > 0
            ? `Reduces delay by ${formatDelay(delay.vs_cheapest ?? 0)} vs cheapest.`
            : `${formatDelay(Math.abs(delay.vs_fastest ?? 0))} slower than fastest.`)
        : 'No delay impact.',
      color: 'border-yellow-700/40 bg-yellow-900/10',
    },
    {
      icon: <Shield className="w-4 h-4 text-blue-400" />,
      label: risk.label || 'Risk and cold-chain protection',
      detail: `Risk level: ${(risk.level ?? 'low').toUpperCase()}. ` +
        `Cold-chain risk: ${((risk.cold_chain_risk ?? 0) * 100).toFixed(0)}% for ${risk.cold_chain_count ?? 0} temp-sensitive shipments.`,
      color: 'border-blue-700/40 bg-blue-900/10',
    },
    {
      icon: <Package className="w-4 h-4 text-purple-400" />,
      label: cargo.label || 'Cargo value and priority protection',
      detail: `${formatCurrency(cargo.total_value ?? 0)} total cargo at risk. ` +
        `${cargo.high_priority ?? 0} high-priority shipments prioritized.`,
      color: 'border-purple-700/40 bg-purple-900/10',
    },
    {
      icon: <Truck className="w-4 h-4 text-orange-400" />,
      label: fleet.label || 'Fleet availability and deployment',
      detail: `${fleet.vehicles_required ?? 0} vehicles required, ` +
        `${fleet.available ?? 0} available in network.`,
      color: 'border-orange-700/40 bg-orange-900/10',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Explanation Header */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-200">Why ChainMind Recommends This Strategy</h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="w-3 h-3" />
            {explanation.used_llm
              ? <span className="text-blue-400">LLM-enhanced ({explanation.llm_provider})</span>
              : <span>Template explanation (configure LLM_PROVIDER for AI-enhanced)</span>
            }
          </div>
        </div>
        <div className="card-body">
          {/* Crisis Summary */}
          {explanation.crisis_summary && (
            <div className="bg-slate-750 rounded-lg p-4 mb-4 text-sm text-slate-300 leading-relaxed">
              {explanation.crisis_summary.split('\n\n').map((para, i) => (
                <p key={i} className={i > 0 ? 'mt-3' : ''}>
                  {para.replace(/\*\*/g, '')}
                </p>
              ))}
            </div>
          )}

          {/* Main Explanation */}
          {explanation.explanation ? (
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 text-sm text-slate-200 leading-relaxed">
              {explanation.explanation}
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-sm text-slate-500">
              AI explanation unavailable for this run.
            </div>
          )}
        </div>
      </div>

      {/* Decision Basis Grid — only show when basis data is meaningful */}
      {explanation.explanation_basis && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-slate-200">Decision Basis — Explainable AI Factors</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {reasons.map((r, i) => (
                <div key={i} className={`rounded-lg border p-4 ${r.color}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {r.icon}
                    <span className="text-sm font-medium text-slate-200">{r.label}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{r.detail}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-3 text-center">
              Scoring weights: 30% delay · 25% cost · 25% cold-chain risk · 20% overall risk
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
