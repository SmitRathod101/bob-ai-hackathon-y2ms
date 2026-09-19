import type { ImpactSummary } from '../services/api';
import { formatCurrency, formatDelay } from '../utils/format';
import { Package, DollarSign, Clock, AlertTriangle, ThermometerSnowflake, Route } from 'lucide-react';

interface ImpactSummaryPanelProps {
  impact: ImpactSummary;
}

export default function ImpactSummaryPanel({ impact }: ImpactSummaryPanelProps) {
  const metrics = [
    {
      label: 'Affected Shipments',
      value: impact.total_affected_shipments,
      sub: `${impact.directly_affected} direct · ${impact.indirectly_affected} cascading`,
      icon: <Package className="w-5 h-5 text-red-400" />,
      highlight: true,
    },
    {
      label: 'Cargo Value Exposed',
      value: formatCurrency(impact.total_cargo_value_exposed),
      sub: 'at risk',
      icon: <DollarSign className="w-5 h-5 text-orange-400" />,
    },
    {
      label: 'Average Delay',
      value: formatDelay(impact.average_delay_hours),
      sub: `${impact.average_delay_hours.toFixed(1)} hours`,
      icon: <Clock className="w-5 h-5 text-yellow-400" />,
    },
    {
      label: 'High-Priority',
      value: impact.high_priority_affected,
      sub: 'P1 + P2 shipments',
      icon: <AlertTriangle className="w-5 h-5 text-red-400" />,
    },
    {
      label: 'Cold-Chain at Risk',
      value: impact.cold_chain_at_risk,
      sub: 'temp-sensitive',
      icon: <ThermometerSnowflake className="w-5 h-5 text-cyan-400" />,
    },
    {
      label: 'Disrupted Routes',
      value: impact.disrupted_routes,
      sub: 'directly blocked',
      icon: <Route className="w-5 h-5 text-purple-400" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map(m => (
        <div key={m.label} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            {m.icon}
            <span className="text-xs text-gray-500">{m.label}</span>
          </div>
          <div className="text-xl font-bold text-gray-900">{m.value}</div>
          <div className="text-xs text-gray-400 mt-0.5">{m.sub}</div>
        </div>
      ))}
    </div>
  );
}
