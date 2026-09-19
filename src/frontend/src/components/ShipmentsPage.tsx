import { useState, useEffect } from 'react';
import { getShipments, type Shipment } from '../services/api';
import { formatCurrency } from '../utils/format';
import {
  Package, AlertTriangle, ThermometerSnowflake, Truck,
  CheckCircle2, Clock, RefreshCw, Filter,
} from 'lucide-react';

const STATUS_OPTIONS = ['all', 'in_transit', 'at_port', 'delayed', 'at_warehouse', 'delivered'] as const;

function riskClass(score: number) {
  if (score >= 0.75) return 'badge-critical';
  if (score >= 0.5)  return 'badge-high';
  if (score >= 0.25) return 'badge-medium';
  return 'badge-low';
}

function riskLabel(score: number) {
  if (score >= 0.75) return 'Critical';
  if (score >= 0.5)  return 'High';
  if (score >= 0.25) return 'Medium';
  return 'Low';
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  in_transit:   <Truck className="w-3.5 h-3.5 text-blue-600" />,
  at_port:      <Package className="w-3.5 h-3.5 text-violet-600" />,
  delayed:      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
  at_warehouse: <Package className="w-3.5 h-3.5 text-cyan-600" />,
  delivered:    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
};

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<number | undefined>(undefined);
  const [coldOnly, setColdOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Parameters<typeof getShipments>[0] = { limit: 100 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (coldOnly) params.temperature_sensitive = true;
      const result = await getShipments(params);
      setShipments(result.shipments ?? []);
      setTotal(result.total ?? 0);
    } catch {
      setShipments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter, priorityFilter, coldOnly]);

  const stats = {
    inTransit: shipments.filter(s => s.status === 'in_transit').length,
    delayed:   shipments.filter(s => s.status === 'delayed').length,
    coldChain: shipments.filter(s => s.temperature_sensitive).length,
    highRisk:  shipments.filter(s => s.risk_score >= 0.5).length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Shipments
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">{total} shipments in network</p>
        </div>
        <button
          onClick={load}
          className="btn-secondary flex items-center gap-2 text-sm"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'In Transit', value: stats.inTransit, accent: 'blue' },
          { label: 'Delayed',    value: stats.delayed,   accent: 'amber' },
          { label: 'Cold-Chain', value: stats.coldChain, accent: 'cyan' },
          { label: 'High Risk',  value: stats.highRisk,  accent: 'red' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border shadow-sm p-3 ${
            s.accent === 'blue'  ? 'border-blue-200  bg-blue-50' :
            s.accent === 'amber' ? 'border-amber-200 bg-amber-50' :
            s.accent === 'cyan'  ? 'border-cyan-200  bg-cyan-50' :
                                   'border-red-200   bg-red-50'
          }`}>
            <div className={`text-2xl font-bold ${
              s.accent === 'blue'  ? 'text-blue-700' :
              s.accent === 'amber' ? 'text-amber-700' :
              s.accent === 'cyan'  ? 'text-cyan-700' :
                                     'text-red-700'
            }`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            {/* Status filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs px-2.5 py-1 rounded-lg border capitalize transition-colors ${
                    statusFilter === s
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 bg-white'
                  }`}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <div className="h-4 border-l border-slate-200" />
            {/* Cold chain toggle */}
            <button
              onClick={() => setColdOnly(v => !v)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                coldOnly
                  ? 'bg-cyan-600 border-cyan-600 text-white shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 bg-white'
              }`}
            >
              <ThermometerSnowflake className="w-3.5 h-3.5" />
              Cold-chain only
            </button>
            {/* Priority filter */}
            <select
              value={priorityFilter ?? ''}
              onChange={e => setPriorityFilter(e.target.value ? Number(e.target.value) : undefined)}
              className="text-xs bg-white border border-slate-200 text-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 shadow-sm"
            >
              <option value="">All priorities</option>
              <option value="1">Priority 1</option>
              <option value="2">Priority 2</option>
              <option value="3">Priority 3</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="loading-spinner" />
          </div>
        ) : shipments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Package className="w-10 h-10 mb-3 opacity-50 text-slate-400" />
            <p className="text-sm font-medium">No shipments match your filters</p>
            <p className="text-xs mt-1 text-slate-400">Try changing the status filter or clearing the cold-chain toggle</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['ID', 'Route', 'Status', 'Progress', 'Risk', 'Delay', 'Value', 'Priority', 'Flags'].map(h => (
                    <th key={h} className={`text-slate-500 font-semibold px-4 py-3 text-xs uppercase tracking-wide ${
                      ['Progress','Risk','Delay','Value','Priority','Flags'].includes(h) ? 'text-right' : 'text-left'
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.map(s => (
                  <tr key={s.shipment_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-400">{s.shipment_id.slice(0, 8)}…</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-800 font-medium">{s.origin}</div>
                      <div className="text-[11px] text-slate-400">→ {s.destination}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {STATUS_ICONS[s.status] ?? <Clock className="w-3.5 h-3.5 text-slate-400" />}
                        <span className="text-xs text-slate-600 capitalize">{s.status.replace(/_/g, ' ')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${s.progress_pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-8 text-right">{Math.round(s.progress_pct)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`badge text-[10px] ${riskClass(s.risk_score)}`}>
                        {riskLabel(s.risk_score)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-medium ${s.estimated_delay_hours > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                        {s.estimated_delay_hours > 0 ? `+${s.estimated_delay_hours.toFixed(0)}h` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600">
                      {s.cargo_value ? formatCurrency(s.cargo_value) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold rounded px-1.5 py-0.5 ${
                        s.priority === 1 ? 'bg-red-100   text-red-700' :
                        s.priority === 2 ? 'bg-amber-100 text-amber-700' :
                                           'bg-slate-100 text-slate-500'
                      }`}>P{s.priority}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {s.temperature_sensitive && (
                          <span title="Temperature sensitive"><ThermometerSnowflake className="w-3.5 h-3.5 text-cyan-600" /></span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
