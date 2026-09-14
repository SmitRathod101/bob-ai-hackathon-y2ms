import { useState } from 'react';
import type { ReactNode } from 'react';
import type { RecoveryStrategy } from '../services/api';
import { formatCurrency, formatDelay } from '../utils/format';
import { Star, DollarSign, Zap, Brain, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

interface StrategyCardsProps {
  strategies: RecoveryStrategy[];
}

type StrategyMeta = {
  icon: ReactNode;
  color: string;
  border: string;
  bg: string;
  headerBg: string;
};

const STRATEGY_META: Record<string, StrategyMeta> = {
  cheapest: {
    icon: <DollarSign className="w-5 h-5 text-green-400" />,
    color: 'text-green-400',
    border: 'border-green-700/50',
    bg: 'bg-green-900/10',
    headerBg: 'bg-green-900/20',
  },
  fastest: {
    icon: <Zap className="w-5 h-5 text-yellow-400" />,
    color: 'text-yellow-400',
    border: 'border-yellow-700/50',
    bg: 'bg-yellow-900/10',
    headerBg: 'bg-yellow-900/20',
  },
  balanced: {
    icon: <Brain className="w-5 h-5 text-blue-400" />,
    color: 'text-blue-400',
    border: 'border-blue-600',
    bg: 'bg-blue-900/20',
    headerBg: 'bg-blue-900/30',
  },
};

export default function StrategyCards({ strategies }: StrategyCardsProps) {
  const [expandedActions, setExpandedActions] = useState<Set<string>>(() => {
    // Auto-expand action plan for the recommended strategy
    const recommended = strategies.find(s => s.is_recommended);
    return recommended ? new Set([recommended.strategy_id]) : new Set();
  });

  if (!strategies.length) return null;

  const toggleAction = (id: string) => {
    setExpandedActions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-200">Recovery Strategy Comparison</h3>
        <span className="text-xs text-slate-500">Scored: 30% delay · 25% cost · 25% cold-chain · 20% risk</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {strategies.map(strategy => {
          const meta = STRATEGY_META[strategy.strategy_type] ?? STRATEGY_META.balanced;
          const isExpanded = expandedActions.has(strategy.strategy_id);

          return (
            <div
              key={strategy.strategy_id}
              className={`rounded-xl border-2 transition-all flex flex-col ${meta.border} ${
                strategy.is_recommended ? 'shadow-lg shadow-blue-900/30' : ''
              }`}
            >
              {/* Card Header */}
              <div className={`rounded-t-xl px-5 py-3 flex items-center justify-between ${meta.headerBg}`}>
                <div className="flex items-center gap-2">
                  {meta.icon}
                  <span className={`text-sm font-bold ${meta.color}`}>{strategy.name}</span>
                </div>
                {strategy.is_recommended && (
                  <div className="flex items-center gap-1 bg-blue-600 text-white text-xs px-2.5 py-0.5 rounded-full font-medium">
                    <Star className="w-3 h-3 fill-current" />
                    AI Pick
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div className={`px-5 py-4 flex-1 ${meta.bg}`}>
                <div className="space-y-3">
                  {/* Big numbers */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center bg-slate-800/60 rounded-lg py-2.5 px-2">
                      <p className="text-xl font-bold text-white">{formatCurrency(strategy.additional_cost_inr)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Additional Cost</p>
                    </div>
                    <div className="text-center bg-slate-800/60 rounded-lg py-2.5 px-2">
                      <p className="text-xl font-bold text-white">{formatDelay(strategy.average_delay_hours)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Avg Delay</p>
                    </div>
                  </div>

                  {/* Detail rows */}
                  <div className="space-y-1.5">
                    <MetricRow
                      label="Risk Level"
                      value={
                        <span className={`badge capitalize badge-${strategy.risk_level} text-xs`}>
                          {strategy.risk_level}
                        </span>
                      }
                    />
                    <MetricRow
                      label="Fleet Required"
                      value={<span className="text-white text-sm">{strategy.fleet_required} vehicles</span>}
                    />
                    <MetricRow
                      label="Affected Shipments"
                      value={<span className="text-white text-sm">{strategy.affected_shipments}</span>}
                    />
                    <MetricRow
                      label="Cold-Chain Risk"
                      value={
                        <span className={`text-sm font-medium ${
                          strategy.cold_chain_risk_score > 0.5 ? 'text-red-400' :
                          strategy.cold_chain_risk_score > 0.3 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {(strategy.cold_chain_risk_score * 100).toFixed(0)}%
                        </span>
                      }
                    />
                    {strategy.strategy_score !== undefined && strategy.strategy_score !== null && (
                      <MetricRow
                        label="Strategy Score"
                        value={
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${strategy.is_recommended ? 'bg-blue-500' : 'bg-slate-500'}`}
                                style={{ width: `${Math.max(5, 100 - strategy.strategy_score * 100)}%` }}
                              />
                            </div>
                            <span className="text-slate-400 text-xs">{strategy.strategy_score.toFixed(3)}</span>
                          </div>
                        }
                      />
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-700 pt-3">
                    {strategy.description}
                  </p>
                </div>
              </div>

              {/* Action Plan */}
              {strategy.action_plan.length > 0 && (
                <div className={`border-t ${meta.border} rounded-b-xl overflow-hidden`}>
                  <button
                    onClick={() => toggleAction(strategy.strategy_id)}
                    className={`w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium transition-colors ${
                      isExpanded ? 'text-blue-300 bg-blue-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {isExpanded ? 'Hide' : 'Show'} Action Plan ({strategy.action_plan.length} phases)
                    </span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="px-5 py-4 bg-slate-800/40 space-y-4">
                      {strategy.action_plan.map((phase, i) => (
                        <div key={i}>
                          <p className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              i === 0 ? 'bg-red-600 text-white' : i === 1 ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white'
                            }`}>{i + 1}</span>
                            {phase.time}
                          </p>
                          <ul className="space-y-1.5 ml-6">
                            {phase.actions.map((action, j) => (
                              <li key={j} className="text-xs text-slate-400 flex items-start gap-1.5">
                                <span className="text-blue-400 mt-0.5 flex-shrink-0">→</span>
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      {value}
    </div>
  );
}
