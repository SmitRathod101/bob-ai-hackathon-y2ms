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

const DARK_TOOLTIP = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 },
  itemStyle: { color: '#e2e8f0' },
  labelStyle: { color: '#94a3b8' },
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
          <h3 className="text-sm font-semibold text-slate-200">Risk Distribution</h3>
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
              <Tooltip {...DARK_TOOLTIP} />
              <Legend
                formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Delay Distribution Bar */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-slate-200">Delay Distribution</h3>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={delayData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip {...DARK_TOOLTIP} />
              <Bar dataKey="count" name="Shipments" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Strategy Comparison Bar */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-slate-200">Strategy Comparison</h3>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={strategyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip {...DARK_TOOLTIP} />
              <Bar dataKey="delay" name="Avg Delay (h)" fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="cost" name="Cost (₹L)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
