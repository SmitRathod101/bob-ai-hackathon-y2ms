import { useState } from 'react';
import type { RecoveryStrategy } from '../services/api';
import { formatCurrency, formatDelay } from '../utils/format';
import { Star, DollarSign, Zap, Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface StrategyCardsProps {
  strategies: RecoveryStrategy[];
}

const STRATEGY_META: Record<string, { icon: React.ReactNode; color: string; border: string; bg: string }> = {
  cheapest: {
    icon: <DollarSign className="w-5 h-5 text-green-400" />,
    color: 'text-green-400',
    border: 'border-green-700/50',
    bg: 'bg-green-900/10',
  },
  fastest: {
    icon: <Zap className="w-5 h-5 text-yellow-400" />,
    color: 'text-yellow-400',
    border: 'border-yellow-700/50',
    bg: 'bg-yellow-900/10',
  },
  balanced: {
    icon: <Brain className="w-5 h-5 text-blue-400" />,
    color: 'text-blue-400',
    border: 'border-blue-600',
    bg: 'bg-blue-900/20',
  },
};

export default function StrategyCards({ strategies }: StrategyCardsProps) {
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  if (!strategies.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-slate-200">Recovery Strategy Comparison</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {strategies.map(strategy => {
          const meta = STRATEGY_META[strategy.strategy_type] ?? STRATEGY_META.balanced;
          const isExpanded = expandedAction === strategy.strategy_id;

          return (
            <div
              key={strategy.strategy_id}
              className={`rounded-xl border-2 p-5 transition-all ${meta.border} ${meta.bg} ${
                strategy.is_recommended ? 'ring-2 ring-blue-500/50' : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {meta.icon}
                  <div>
                    <p className={`text-sm font-semibold ${meta.color}`}>{strategy.name}</p>
                  </div>
                </div>
                {strategy.is_recommended && (
                  <div className="flex items-center gap-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3" />
                    Recommended
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Additional Cost</span>
                  <span className="text-white font-medium">{formatCurrency(strategy.additional_cost_inr)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Average Delay</span>
                  <span className="text-white font-medium">{formatDelay(strategy.average_delay_hours)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Risk Level</span>
                  <span className={`font-medium capitalize badge badge-${strategy.risk_level}`}>
                    {strategy.risk_level}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Fleet Required</span>
                  <span className="text-white">{strategy.fleet_required} vehicles</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Cold-Chain Risk</span>
                  <span className={`font-medium ${strategy.cold_chain_risk_score > 0.5 ? 'text-red-400' : strategy.cold_chain_risk_score > 0.3 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {(strategy.cold_chain_risk_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">{strategy.description}</p>

              {/* Action Plan Toggle */}
              {strategy.action_plan.length > 0 && (
                <div>
                  <button
                    onClick={() => setExpandedAction(isExpanded ? null : strategy.strategy_id)}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium w-full"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? 'Hide' : 'Show'} Action Plan
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-3 border-t border-slate-700 pt-3">
                      {strategy.action_plan.map((phase, i) => (
                        <div key={i}>
                          <p className="text-xs font-semibold text-slate-300 mb-1">{phase.time}</p>
                          <ul className="space-y-1">
                            {phase.actions.map((action, j) => (
                              <li key={j} className="text-xs text-slate-400 flex items-start gap-1.5">
                                <span className="text-blue-500 mt-0.5">•</span>
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
