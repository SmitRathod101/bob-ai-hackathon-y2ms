import { formatCurrency, formatDelay } from '../utils/format';
import { Brain, TrendingDown, Clock, Shield, Package, Truck, Info } from 'lucide-react';

interface ExplainableAIProps {
  explanation: {
    explanation: string;
    crisis_summary: string;
    used_llm: boolean;
    llm_provider: string;
    explanation_basis: {
      cost_reasoning: { value: number; vs_cheapest: number; vs_fastest: number; label: string };
      delay_reasoning: { value: number; vs_cheapest: number; vs_fastest: number; label: string };
      risk_reasoning: { level: string; cold_chain_risk: number; cold_chain_count: number; label: string };
      cargo_reasoning: { total_value: number; high_priority: number; label: string };
      fleet_reasoning: { vehicles_required: number; available: number; label: string };
    };
  };
}

export default function ExplainableAI({ explanation }: ExplainableAIProps) {
  const basis = explanation.explanation_basis;

  const reasons = [
    {
      icon: <TrendingDown className="w-4 h-4 text-green-400" />,
      label: basis.cost_reasoning.label,
      detail: `Recovery cost: ${formatCurrency(basis.cost_reasoning.value)}. ` +
        (basis.cost_reasoning.vs_fastest > 0
          ? `Saves ${formatCurrency(basis.cost_reasoning.vs_fastest)} vs fastest option.`
          : `${formatCurrency(Math.abs(basis.cost_reasoning.vs_cheapest))} more than cheapest.`),
      color: 'border-green-700/40 bg-green-900/10',
    },
    {
      icon: <Clock className="w-4 h-4 text-yellow-400" />,
      label: basis.delay_reasoning.label,
      detail: `Average delay: ${formatDelay(basis.delay_reasoning.value)}. ` +
        (basis.delay_reasoning.vs_cheapest > 0
          ? `Reduces delay by ${formatDelay(basis.delay_reasoning.vs_cheapest)} vs cheapest.`
          : `${formatDelay(Math.abs(basis.delay_reasoning.vs_fastest))} slower than fastest.`),
      color: 'border-yellow-700/40 bg-yellow-900/10',
    },
    {
      icon: <Shield className="w-4 h-4 text-blue-400" />,
      label: basis.risk_reasoning.label,
      detail: `Risk level: ${basis.risk_reasoning.level.toUpperCase()}. ` +
        `Cold-chain risk: ${(basis.risk_reasoning.cold_chain_risk * 100).toFixed(0)}% for ${basis.risk_reasoning.cold_chain_count} temp-sensitive shipments.`,
      color: 'border-blue-700/40 bg-blue-900/10',
    },
    {
      icon: <Package className="w-4 h-4 text-purple-400" />,
      label: basis.cargo_reasoning.label,
      detail: `${formatCurrency(basis.cargo_reasoning.total_value)} total cargo at risk. ` +
        `${basis.cargo_reasoning.high_priority} high-priority shipments prioritized.`,
      color: 'border-purple-700/40 bg-purple-900/10',
    },
    {
      icon: <Truck className="w-4 h-4 text-orange-400" />,
      label: basis.fleet_reasoning.label,
      detail: `${basis.fleet_reasoning.vehicles_required} vehicles required, ` +
        `${basis.fleet_reasoning.available} available in network.`,
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
          <div className="bg-slate-750 rounded-lg p-4 mb-4 text-sm text-slate-300 leading-relaxed">
            {explanation.crisis_summary.split('\n\n').map((para, i) => (
              <p key={i} className={i > 0 ? 'mt-3' : ''}>
                {para.replace(/\*\*/g, '')}
              </p>
            ))}
          </div>

          {/* Main Explanation */}
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 text-sm text-slate-200 leading-relaxed">
            {explanation.explanation}
          </div>
        </div>
      </div>

      {/* Decision Basis Grid */}
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
    </div>
  );
}
