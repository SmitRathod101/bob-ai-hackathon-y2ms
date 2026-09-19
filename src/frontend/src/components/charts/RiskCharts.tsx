import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid
} from 'recharts';
import type { RecoveryStrategy } from '../../services/api';

const RISK_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const LIGHT_TOOLTIP = {
  contentStyle: { background: '#ffffff', border: '1px solid #e5e7eb', color: '#1f2328', fontSize: 12, borderRadius: 6 },
  itemStyle: { color: '#374151' },
  labelStyle: { color: '#6b7280' },
};

interface RiskChartsProps {
  riskDistribution: { low: number; medium: number; high: number; critical: number };
  delayDistribution: Record<string, number>;
  strategies: RecoveryStrategy[];
}

export default function RiskCharts({ riskDistribution, delayDistribution, strategies }: RiskChartsProps) {
  const riskData = Object.entries(riskDistribution)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  const delayData = Object.entries(delayDistribution).map(([range, count]) => ({
    range,
    count,
  }));

  const strategyData = strategies.map(s => ({
    name: s.strategy_type === 'cheapest' ? 'Cheapest' : s.strategy_type === 'fastest' ? 'Fastest' : 'Balanced',
    cost: s.additional_cost_inr / 1_00_000,  // in lakhs
    delay: s.average_delay_hours,
    recommended: s.is_recommended,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Risk Distribution Pie */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-gray-800">Risk Distribution</h3>
        </div>
        <div className="card-body flex items-center justify-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={riskData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {riskData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={RISK_COLORS[entry.name.toLowerCase() as keyof typeof RISK_COLORS] ?? '#6b7280'}
                  />
                ))}
              </Pie>
              <Tooltip {...LIGHT_TOOLTIP} />
              <Legend
                formatter={(value) => <span style={{ color: '#6b7280', fontSize: 12 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Delay Distribution Bar */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-gray-800">Delay Distribution</h3>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={delayData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="range" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip {...LIGHT_TOOLTIP} />
              <Bar dataKey="count" name="Shipments" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Strategy Comparison Bar */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-gray-800">Strategy Comparison</h3>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={strategyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip {...LIGHT_TOOLTIP} />
              <Bar dataKey="delay" name="Avg Delay (h)" fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="cost" name="Cost (₹L)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Legend formatter={(v) => <span style={{ color: '#6b7280', fontSize: 11 }}>{v}</span>} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
