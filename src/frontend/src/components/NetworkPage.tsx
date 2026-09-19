import { useState, useEffect } from 'react';
import { getRoutes, getConnections, type Route, type ConnectionRecord } from '../services/api';
import {
  Network, Truck, Train, Anchor, AlertTriangle, CheckCircle2,
  RefreshCw, Activity, XCircle,
} from 'lucide-react';

const MODE_ICONS: Record<string, React.ReactNode> = {
  truck:  <Truck className="w-3.5 h-3.5 text-blue-400" />,
  rail:   <Train className="w-3.5 h-3.5 text-purple-400" />,
  sea:    <Anchor className="w-3.5 h-3.5 text-cyan-400" />,
  air:    <Activity className="w-3.5 h-3.5 text-amber-400" />,
};

function statusConfig(status: string) {
  switch (status) {
    case 'available': return { label: 'Available', cls: 'badge-low', icon: <CheckCircle2 className="w-3 h-3 text-emerald-600" /> };
    case 'degraded':  return { label: 'Degraded',  cls: 'badge-medium', icon: <AlertTriangle className="w-3 h-3 text-amber-600" /> };
    default:          return { label: 'Unavailable', cls: 'badge-critical', icon: <XCircle className="w-3 h-3 text-red-600" /> };
  }
}

export default function NetworkPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'routes' | 'connections'>('routes');
  // (palette converted to light theme)

  const load = async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([getRoutes(false), getConnections()]);
      setRoutes(r);
      setConnections(c);
    } catch {
      // leave empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const activeRoutes    = routes.filter(r => r.is_active).length;
  const degradedConns   = connections.filter(c => c.status === 'degraded').length;
  const unavailConns    = connections.filter(c => c.status === 'unavailable').length;
  const highRiskRoutes  = routes.filter(r => r.risk_score >= 0.5).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-600" />
            Network
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Routes, connections and transport modes</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Routes',     value: activeRoutes,   accent: 'green' },
          { label: 'High Risk Routes',  value: highRiskRoutes, accent: 'red' },
          { label: 'Degraded Links',    value: degradedConns,  accent: 'amber' },
          { label: 'Unavailable Links', value: unavailConns,   accent: 'red' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border shadow-sm p-3 ${
            s.accent === 'green' ? 'border-emerald-200 bg-emerald-50' :
            s.accent === 'amber' ? 'border-amber-200   bg-amber-50' :
                                   'border-red-200     bg-red-50'
          }`}>
            <div className={`text-2xl font-bold ${
              s.accent === 'green' ? 'text-emerald-700' :
              s.accent === 'amber' ? 'text-amber-700' :
                                     'text-red-700'
            }`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1">
        {(['routes', 'connections'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            {t} ({t === 'routes' ? routes.length : connections.length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="loading-spinner" /></div>
      ) : tab === 'routes' ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Route', 'Mode', 'Distance', 'Normal Time', 'Congestion', 'Risk', 'Status'].map(h => (
                    <th key={h} className="text-left text-slate-500 font-semibold px-4 py-3 text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {routes.map(r => {
                  const congPct = Math.round(r.congestion * 100);
                  const riskPct = Math.round(r.risk_score * 100);
                  return (
                    <tr key={r.route_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-800 font-medium">{r.origin}</div>
                        <div className="text-[11px] text-slate-400">→ {r.destination}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {MODE_ICONS[r.transport_mode] ?? <Truck className="w-3.5 h-3.5 text-slate-400" />}
                          <span className="text-xs text-slate-500 capitalize">{r.transport_mode}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{r.distance_km.toFixed(0)} km</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{r.normal_time_hours.toFixed(1)}h</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${congPct > 65 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${congPct}%` }}
                            />
                          </div>
                          <span className={`text-xs ${congPct > 65 ? 'text-amber-700' : 'text-slate-400'}`}>{congPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge text-[10px] ${
                          riskPct >= 75 ? 'badge-critical' :
                          riskPct >= 50 ? 'badge-high' :
                          riskPct >= 25 ? 'badge-medium' :
                                          'badge-low'
                        }`}>{riskPct}%</span>
                      </td>
                      <td className="px-4 py-3">
                        {r.is_active
                          ? <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium"><CheckCircle2 className="w-3 h-3" /> Active</span>
                          : <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><XCircle className="w-3 h-3" /> Inactive</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Connection', 'Mode', 'Distance', 'Status', 'Disruption'].map(h => (
                    <th key={h} className="text-left text-slate-500 font-semibold px-4 py-3 text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {connections.map(c => {
                  const sc = statusConfig(c.status);
                  return (
                    <tr key={c.connection_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-800 font-medium">{c.from_node}</div>
                        <div className="text-[11px] text-slate-400">→ {c.to_node}</div>
                        {c.name && <div className="text-[10px] text-slate-400">{c.name}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {MODE_ICONS[c.transport_mode] ?? <Truck className="w-3.5 h-3.5 text-slate-400" />}
                          <span className="text-xs text-slate-500 capitalize">{c.transport_mode}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{c.distance_km.toFixed(0)} km</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-[10px] ${sc.cls}`}>{sc.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {c.disruption_reason ? (
                          <span className="text-amber-700 font-medium">{c.disruption_reason}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
