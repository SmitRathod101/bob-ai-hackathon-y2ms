import type { DashboardSummary, Port } from '../services/api';
import { formatCurrency } from '../utils/format';
import KpiCard from './KpiCard';
import SupplyChainMap from './SupplyChainMap';
import FleetChart from './charts/FleetChart';
import { Package, Truck, ThermometerSnowflake, AlertTriangle, RefreshCw, Ship } from 'lucide-react';

interface DashboardTabProps {
  data: DashboardSummary | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function DashboardTab({ data, loading, onRefresh }: DashboardTabProps) {
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-3" />
          <p className="text-slate-400">Loading supply chain data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p>No data available. Check backend connection.</p>
      </div>
    );
  }

  const fleet = data.fleet_summary;

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Supply Chain Overview</h2>
          <p className="text-slate-400 text-sm mt-0.5">Real-time digital twin status — India logistics network</p>
        </div>
        <button onClick={onRefresh} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          title="Total Shipments"
          value={data.total_shipments}
          subtitle={`${data.in_transit} in transit`}
          icon={<Package className="w-5 h-5 text-blue-400" />}
          color="blue"
        />
        <KpiCard
          title="Cargo Value"
          value={formatCurrency(data.total_cargo_value)}
          subtitle="Active network"
          icon={<Ship className="w-5 h-5 text-purple-400" />}
          color="purple"
        />
        <KpiCard
          title="Delayed"
          value={data.delayed}
          subtitle={`of ${data.total_shipments} shipments`}
          icon={<AlertTriangle className="w-5 h-5 text-orange-400" />}
          color="orange"
          alert={data.delayed > 10}
        />
        <KpiCard
          title="Cold-Chain"
          value={data.cold_chain_shipments}
          subtitle="Temp-sensitive"
          icon={<ThermometerSnowflake className="w-5 h-5 text-cyan-400" />}
          color="cyan"
        />
        <KpiCard
          title="High Priority"
          value={data.high_priority_shipments}
          subtitle="P1 + P2 shipments"
          icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
          color="red"
        />
        <KpiCard
          title="Fleet Available"
          value={`${fleet.available_vehicles}/${fleet.total_vehicles}`}
          subtitle={`${fleet.utilization_pct}% utilized`}
          icon={<Truck className="w-5 h-5 text-green-400" />}
          color="green"
        />
      </div>

      {/* Map + Fleet Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SupplyChainMap
            ports={data.ports}
            disruptedPortIds={[]}
            disruptedRouteIds={[]}
          />
        </div>
        <div className="space-y-4">
          <FleetChart fleetSummary={fleet} />
          {/* Shipment status breakdown */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-slate-200">Shipment Status</h3>
            </div>
            <div className="card-body space-y-2">
              {[
                { label: 'In Transit', count: data.in_transit, color: 'bg-blue-500' },
                { label: 'At Port', count: data.at_port, color: 'bg-purple-500' },
                { label: 'Delayed', count: data.delayed, color: 'bg-orange-500' },
                { label: 'At Warehouse', count: data.at_warehouse, color: 'bg-cyan-500' },
                { label: 'Delivered', count: data.delivered, color: 'bg-green-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${item.color} flex-shrink-0`} />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-sm text-slate-300">{item.label}</span>
                      <span className="text-sm font-medium text-white">{item.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full`}
                        style={{ width: `${(item.count / data.total_shipments) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Port Status */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Port Network Status</h3>
          <span className="text-xs text-slate-500">{data.ports.length} major ports</span>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.ports.map(port => (
              <PortStatusCard key={port.port_id} port={port} />
            ))}
          </div>
        </div>
      </div>

      {/* Recent Simulations */}
      {data.recent_simulations.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-slate-200">Recent Simulations</h3>
          </div>
          <div className="card-body p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 font-medium px-5 py-2.5">Scenario</th>
                  <th className="text-right text-slate-400 font-medium px-5 py-2.5">Affected</th>
                  <th className="text-right text-slate-400 font-medium px-5 py-2.5">Cargo Exposed</th>
                  <th className="text-right text-slate-400 font-medium px-5 py-2.5">Avg Delay</th>
                  <th className="text-right text-slate-400 font-medium px-5 py-2.5">Strategy</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_simulations.map(sim => (
                  <tr key={sim.simulation_id} className="border-b border-slate-800 hover:bg-slate-750">
                    <td className="px-5 py-3">
                      <div className="text-slate-200 font-medium">{sim.scenario_name || sim.location}</div>
                      <div className="text-slate-500 text-xs">{sim.duration_hours}h · {sim.severity}</div>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-300">{sim.total_affected_shipments}</td>
                    <td className="px-5 py-3 text-right text-slate-300">{formatCurrency(sim.total_cargo_value_exposed)}</td>
                    <td className="px-5 py-3 text-right text-slate-300">{(sim.average_delay_hours ?? 0).toFixed(1)}h</td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-blue-400 capitalize">{sim.recommended_strategy ?? '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PortStatusCard({ port }: { port: Port }) {
  const congestionPct = Math.round(port.congestion * 100);
  const isHigh = port.congestion > 0.65;
  const isDisrupted = port.operational_status !== 'operational';

  return (
    <div className={`rounded-lg p-3 border ${isDisrupted ? 'border-red-700 bg-red-900/20' : 'border-slate-700 bg-slate-750'}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-semibold text-slate-200">{port.name}</p>
          <p className="text-xs text-slate-500">{port.city}</p>
        </div>
        <div className={`w-2 h-2 rounded-full mt-1 ${isDisrupted ? 'bg-red-500' : isHigh ? 'bg-orange-500' : 'bg-green-500'}`} />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Congestion</span>
          <span className={isHigh ? 'text-orange-400' : 'text-green-400'}>{congestionPct}%</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isHigh ? 'bg-orange-500' : 'bg-green-500'}`}
            style={{ width: `${congestionPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
