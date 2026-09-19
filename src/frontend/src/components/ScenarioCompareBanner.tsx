import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { formatCurrency, formatDelay } from '../utils/format';
import type { SimulationResult } from '../services/api';

interface ScenarioCompareBannerProps {
  previous: SimulationResult;
  current: SimulationResult;
}

function Delta({
  prev,
  curr,
  formatter,
  lowerIsBetter,
}: {
  prev: number;
  curr: number;
  formatter: (v: number) => string;
  lowerIsBetter: boolean;
}) {
  const diff = curr - prev;
  const pct = prev !== 0 ? Math.abs((diff / prev) * 100).toFixed(1) : '—';
  const increased = diff > 0;
  const improved = lowerIsBetter ? !increased : increased;
  const noChange = Math.abs(diff) < 0.01;

  if (noChange) {
    return (
      <div className="flex items-center gap-1 text-gray-400">
        <Minus className="w-3 h-3" />
        <span className="text-xs">No change</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 text-xs font-medium ${improved ? 'text-green-600' : 'text-red-600'}`}>
      {increased
        ? <TrendingUp className="w-3.5 h-3.5" />
        : <TrendingDown className="w-3.5 h-3.5" />
      }
      <span>{increased ? '+' : '-'}{pct}%</span>
      <span className="text-gray-400 font-normal">
        ({formatter(Math.abs(diff))})
      </span>
    </div>
  );
}

export default function ScenarioCompareBanner({ previous, current }: ScenarioCompareBannerProps) {
  const prevImp = previous.impact_summary;
  const currImp = current.impact_summary;
  const prevRec = previous.recommended_strategy;
  const currRec = current.recommended_strategy;

  const strategyChanged = prevRec?.strategy_type !== currRec?.strategy_type;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-blue-700">What-If Comparison — Scenario Changed</h3>
          <p className="text-xs text-gray-500">
            Comparing <strong className="text-gray-700">{previous.scenario.location} {previous.scenario.duration_hours}h {previous.scenario.severity}</strong>
            <ArrowRight className="w-3 h-3 inline mx-1" />
            <strong className="text-gray-700">{current.scenario.location} {current.scenario.duration_hours}h {current.scenario.severity}</strong>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CompareCell
          label="Affected Shipments"
          prev={prevImp.total_affected_shipments}
          curr={currImp.total_affected_shipments}
          formatter={v => String(Math.round(v))}
          lowerIsBetter={true}
        />
        <CompareCell
          label="Average Delay"
          prev={prevImp.average_delay_hours}
          curr={currImp.average_delay_hours}
          formatter={formatDelay}
          lowerIsBetter={true}
        />
        <CompareCell
          label="Cargo Exposed"
          prev={prevImp.total_cargo_value_exposed}
          curr={currImp.total_cargo_value_exposed}
          formatter={formatCurrency}
          lowerIsBetter={true}
        />
        <CompareCell
          label="Cold-Chain at Risk"
          prev={prevImp.cold_chain_at_risk}
          curr={currImp.cold_chain_at_risk}
          formatter={v => String(Math.round(v))}
          lowerIsBetter={true}
        />
      </div>

      {strategyChanged && prevRec && currRec && (
        <div className="mt-4 pt-4 border-t border-blue-200 flex items-center gap-3 text-sm">
          <span className="text-gray-600">Recommended strategy changed:</span>
          <span className="badge badge-medium capitalize">{prevRec.strategy_type}</span>
          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
          <span className="badge badge-high capitalize">{currRec.strategy_type}</span>
          <span className="text-gray-400 text-xs ml-1">
            (due to changed scenario parameters)
          </span>
        </div>
      )}
      {!strategyChanged && prevRec && (
        <div className="mt-4 pt-4 border-t border-blue-200 text-xs text-gray-500">
          Recommended strategy unchanged: <span className="text-blue-600 font-medium capitalize">{prevRec.strategy_type}</span>
          {' — but cost/delay figures have changed. See updated strategy cards below.'}
        </div>
      )}
    </div>
  );
}

function CompareCell({
  label, prev, curr, formatter, lowerIsBetter,
}: {
  label: string;
  prev: number;
  curr: number;
  formatter: (v: number) => string;
  lowerIsBetter: boolean;
}) {
  return (
    <div className="bg-white border border-blue-100 rounded-lg p-3 shadow-sm">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-gray-400 text-sm line-through">{formatter(prev)}</span>
        <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
        <span className="text-gray-900 font-bold">{formatter(curr)}</span>
      </div>
      <Delta prev={prev} curr={curr} formatter={formatter} lowerIsBetter={lowerIsBetter} />
    </div>
  );
}
