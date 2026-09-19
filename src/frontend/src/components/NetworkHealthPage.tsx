import { useState, useEffect } from 'react';
import {
  getDashboardSummary, getRoutes, getConnections, getTwinState,
  type DashboardSummary, type Route, type ConnectionRecord, type TwinState,
} from '../services/api';
import { formatCurrency } from '../utils/format';
import {
  BarChart3, RefreshCw, Activity, AlertTriangle,
  Truck, Ship, ThermometerSnowflake, Network, TrendingUp,
} from 'lucide-react';

export default function NetworkHealthPage() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [twin, setTwin] = useState<TwinState | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [d, r, c, t] = await Promise.all([
        getDashboardSummary(),
        getRoutes(false),
        getConnections(),
        getTwinState(),
      ]);
      setDashboard(d);
      setRoutes(r);
      setConnections(c);
      setTwin(t);
    } catch {
      // best effort
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading network health…</p>
        </div>
      </div>
    );
  }

  const networkStatus = twin?.network_health ?? 'normal';
  const statusCfg = {
    normal:    { label: 'Healthy',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    warning:   { label: 'Warning',   cls: 'bg-amber-50   text-amber-700   border-amber-200',   dot: 'bg-amber-500' },
    crisis:    { label: 'Critical',  cls: 'bg-red-50     text-red-700     border-red-200',      dot: 'bg-red-500 animate-pulse' },
    recovery:  { label: 'Recovery',  cls: 'bg-violet-50  text-violet-700  border-violet-200',   dot: 'bg-violet-500' },
    recovered: { label: 'Recovered', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',  dot: 'bg-emerald-500' },
  }[networkStatus] ?? { label: 'Unknown', cls: 'bg-slate-100 text-slate-600 border-slate-300', dot: 'bg-slate-400' };

  const activeRoutes   = routes.filter(r => r.is_active).length;
  const disruptedConns = connections.filter(c => c.status !== 'available').length;
  const highRiskRoutes = routes.filter(r => r.risk_score >= 0.5).length;
  const congRoutes     = routes.filter(r => r.congestion > 0.65).length;
  const avgRisk        = routes.length > 0
    ? routes.reduce((s, r) => s + r.risk_score, 0) / routes.length
    : 0;

  const fleet = dashboard?.fleet_summary;
  const ports = dashboard?.ports ?? [];
  const disruptedPorts = ports.filter(p => p.operational_status !== 'operational');

  // Health score (0-100)
  const healthScore = Math.max(0, Math.round(
    100
    - (disruptedConns / Math.max(connections.length, 1)) * 30
    - (highRiskRoutes / Math.max(routes.length, 1)) * 25
    - (disruptedPorts.length / Math.max(ports.length, 1)) * 20
    - (congRoutes / Math.max(routes.length, 1)) * 15
    - (dashboard ? (dashboard.delayed / Math.max(dashboard.total_shipments, 1)) * 10 : 0)
  ));

  const healthColor = healthScore >= 80 ? 'text-emerald-600' : healthScore >= 60 ? 'text-amber-600' : 'text-red-600';
  const healthBarColor = healthScore >= 80 ? 'bg-green-500' : healthScore >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Network Health
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Overall supply chain network status and metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 border rounded px-3 py-1.5 text-sm font-semibold ${statusCfg.cls}`}>
            <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </div>
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Health score */}
      <div className="card">
        <div className="card-body py-4">
          <div className="flex items-center gap-6">
            <div className="text-center flex-shrink-0">
              <div className={`text-5xl font-bold ${healthColor}`}>{healthScore}</div>
              <div className="text-xs text-slate-400 mt-1">Health Score</div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Network Health</span>
                <span>{healthScore}/100</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${healthBarColor}`}
                  style={{ width: `${healthScore}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[11px] text-slate-400">
                <span>Critical (0-40)</span>
                <span>Warning (40-70)</span>
                <span>Healthy (70-100)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <HealthMetric
          label="Active Routes"
          value={`${activeRoutes}/${routes.length}`}
          status={activeRoutes === routes.length ? 'good' : 'warn'}
          icon={<Activity className="w-4 h-4" />}
        />
        <HealthMetric
          label="Disrupted Links"
          value={String(disruptedConns)}
          status={disruptedConns === 0 ? 'good' : disruptedConns < 3 ? 'warn' : 'bad'}
          icon={<Network className="w-4 h-4" />}
        />
        <HealthMetric
          label="High Risk Routes"
          value={String(highRiskRoutes)}
          status={highRiskRoutes === 0 ? 'good' : highRiskRoutes < 5 ? 'warn' : 'bad'}
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <HealthMetric
          label="Network Avg Risk"
          value={`${Math.round(avgRisk * 100)}%`}
          status={avgRisk < 0.3 ? 'good' : avgRisk < 0.6 ? 'warn' : 'bad'}
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Port health */}
        <div className="card lg:col-span-2">
          <div className="card-header py-3 flex items-center gap-2">
            <Ship className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Port Network Status</h3>
          </div>
          <div className="card-body py-3 space-y-2">
            {ports.map(port => {
              const congPct = Math.round(port.congestion * 100);
              const isDisrupted = port.operational_status !== 'operational';
              const isHigh = port.congestion > 0.65;
              return (
                <div key={port.port_id} className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    isDisrupted ? 'bg-red-500 animate-pulse' : isHigh ? 'bg-amber-500' : 'bg-green-500'
                  }`} />
                  <div className="w-28 flex-shrink-0">
                    <div className="text-xs text-slate-800 font-medium truncate">{port.name}</div>
                    <div className="text-[10px] text-slate-400">{port.city}</div>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isHigh ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${congPct}%` }}
                      />
                    </div>
                  </div>
                  <div className={`w-14 text-right text-xs font-medium ${isHigh ? 'text-amber-700' : 'text-slate-500'}`}>
                    {congPct}%
                  </div>
                  <div className={`w-20 text-right text-[10px] ${isDisrupted ? 'text-red-700' : 'text-emerald-700'}`}>
                    {isDisrupted ? port.operational_status : 'operational'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fleet + Cargo */}
        <div className="space-y-3">
          {fleet && (
            <div className="card">
              <div className="card-header py-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-800">Fleet Status</h3>
              </div>
              <div className="card-body py-3 space-y-2.5">
                <FleetRow label="Total Fleet" value={fleet.total_vehicles} max={fleet.total_vehicles} color="bg-blue-500" />
                <FleetRow label="Available" value={fleet.available_vehicles} max={fleet.total_vehicles} color="bg-green-500" />
                <FleetRow label="Utilized" value={fleet.utilized_vehicles} max={fleet.total_vehicles} color="bg-amber-500" />
                <FleetRow label="Refrigerated" value={fleet.refrigerated_vehicles} max={fleet.total_vehicles} color="bg-cyan-500" />
              </div>
            </div>
          )}

          {dashboard && (
            <div className="card">
              <div className="card-header py-3 flex items-center gap-2">
                <ThermometerSnowflake className="w-4 h-4 text-cyan-600" />
                <h3 className="text-sm font-semibold text-slate-800">Cargo Overview</h3>
              </div>
              <div className="card-body py-3 space-y-2">
                <InfoRow label="Total Network Value" value={formatCurrency(dashboard.total_cargo_value)} />
                <InfoRow label="Cold-Chain" value={`${dashboard.cold_chain_shipments} shipments`} />
                <InfoRow label="High Priority" value={`${dashboard.high_priority_shipments} shipments`} />
                <InfoRow label="Delayed" value={`${dashboard.delayed} shipments`} accent={dashboard.delayed > 0 ? 'amber' : 'green'} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection health breakdown */}
      <div className="card">
        <div className="card-header py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Connection Health Breakdown</h3>
          </div>
          <span className="text-xs text-slate-500">{connections.length} total connections</span>
        </div>
        <div className="card-body py-3">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Available',   count: connections.filter(c => c.status === 'available').length,   color: 'bg-emerald-500', textColor: 'text-emerald-700' },
              { label: 'Degraded',    count: connections.filter(c => c.status === 'degraded').length,    color: 'bg-amber-500', textColor: 'text-amber-700' },
              { label: 'Unavailable', count: connections.filter(c => c.status === 'unavailable').length, color: 'bg-red-500',   textColor: 'text-red-700' },
            ].map(item => (
              <div key={item.label} className="text-center">
                <div className={`text-3xl font-bold ${item.textColor}`}>{item.count}</div>
                <div className="text-xs text-slate-400 mt-1">{item.label}</div>
                <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full`}
                    style={{ width: `${connections.length > 0 ? (item.count / connections.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {disruptedConns > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Disrupted Connections</div>
              {connections.filter(c => c.status !== 'available').slice(0, 8).map(c => (
                <div key={c.connection_id} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs border ${
                  c.status === 'unavailable'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.status === 'unavailable' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className="flex-1 text-slate-700">{c.from_node} → {c.to_node}</span>
                  <span className={c.status === 'unavailable' ? 'text-red-700 font-medium' : 'text-amber-700 font-medium'}>
                    {c.disruption_reason ?? c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthMetric({ label, value, status, icon }: {
  label: string; value: string;
  status: 'good' | 'warn' | 'bad';
  icon: React.ReactNode;
}) {
  const cfg = {
    good: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    warn: { border: 'border-amber-200',   bg: 'bg-amber-50',   text: 'text-amber-700' },
    bad:  { border: 'border-red-200',     bg: 'bg-red-50',     text: 'text-red-700' },
  }[status];
  return (
    <div className={`rounded-xl border p-3 ${cfg.border} ${cfg.bg}`}>
      <div className={`${cfg.text} mb-1`}>{icon}</div>
      <div className={`text-xl font-bold ${cfg.text}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

function FleetRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-800 font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'amber' | 'red' }) {
  const textCls = accent === 'amber' ? 'text-amber-700' : accent === 'red' ? 'text-red-700' : accent === 'green' ? 'text-emerald-700' : 'text-slate-800';
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`font-medium ${textCls}`}>{value}</span>
    </div>
  );
}
