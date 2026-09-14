import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { FleetSummary } from '../../services/api';

const DARK_TOOLTIP = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', fontSize: 12 },
};

export default function FleetChart({ fleetSummary }: { fleetSummary: FleetSummary }) {
  const data = [
    { name: 'Available', value: fleetSummary.available_vehicles, color: '#22c55e' },
    { name: 'In Use', value: fleetSummary.utilized_vehicles, color: '#f97316' },
  ];

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Fleet Utilization</h3>
        <span className="text-xs text-slate-500">{fleetSummary.total_vehicles} total</span>
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value">
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip {...DARK_TOOLTIP} />
            <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="text-center">
            <p className="text-lg font-bold text-white">{fleetSummary.refrigerated_vehicles}</p>
            <p className="text-xs text-cyan-400">Refrigerated</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">{fleetSummary.utilization_pct}%</p>
            <p className="text-xs text-slate-400">Utilization</p>
          </div>
        </div>
      </div>
    </div>
  );
}
