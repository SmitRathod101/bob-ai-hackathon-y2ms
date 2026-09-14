import { Truck, MapPin, Snowflake } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import type { FleetVehicle } from '../services/api';

interface FleetSummary {
  total_vehicles: number;
  available_vehicles: number;
  utilized_vehicles: number;
  refrigerated_vehicles: number;
  refrigerated_available: number;
  average_utilization: number;
  utilization_pct: number;
}

interface FleetRequirements {
  standard_vehicles_needed: number;
  refrigerated_vehicles_needed: number;
  total_vehicles_needed: number;
}

interface FleetAvailabilityPanelProps {
  fleetSummary: FleetSummary;
  availableFleet: FleetVehicle[];
  coldChainFleet: FleetVehicle[];
  fleetRequirements: FleetRequirements;
}

export default function FleetAvailabilityPanel({
  fleetSummary,
  availableFleet,
  coldChainFleet,
  fleetRequirements,
}: FleetAvailabilityPanelProps) {
  const coveragePct = fleetSummary.available_vehicles > 0
    ? Math.min(100, Math.round((fleetSummary.available_vehicles / Math.max(fleetRequirements.total_vehicles_needed, 1)) * 100))
    : 0;
  const canCover = fleetSummary.available_vehicles >= fleetRequirements.total_vehicles_needed;

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-slate-200">Fleet Availability</h3>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${
          canCover ? 'bg-green-900/30 text-green-300 border-green-700' : 'bg-orange-900/30 text-orange-300 border-orange-700'
        }`}>
          {canCover ? 'Sufficient Coverage' : 'Fleet Shortage Risk'}
        </span>
      </div>
      <div className="card-body space-y-4">
        {/* Fleet KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FleetKpi label="Available" value={fleetSummary.available_vehicles} total={fleetSummary.total_vehicles} color="green" />
          <FleetKpi label="In Use" value={fleetSummary.utilized_vehicles} total={fleetSummary.total_vehicles} color="orange" />
          <FleetKpi label="Refrigerated" value={fleetSummary.refrigerated_available} total={fleetSummary.refrigerated_vehicles} color="cyan" />
          <FleetKpi label="Needed" value={fleetRequirements.total_vehicles_needed} total={fleetSummary.total_vehicles} color="blue" />
        </div>

        {/* Recovery capacity bar */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400">Recovery capacity coverage</span>
            <span className={canCover ? 'text-green-400' : 'text-orange-400'}>{coveragePct}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${canCover ? 'bg-green-500' : 'bg-orange-500'}`}
              style={{ width: `${Math.min(100, coveragePct)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {fleetSummary.available_vehicles} available · {fleetRequirements.total_vehicles_needed} needed ({fleetRequirements.refrigerated_vehicles_needed} refrigerated)
          </p>
        </div>

        {/* Available fleet near disruption */}
        {availableFleet.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 font-medium mb-2">
              Nearest available vehicles ({availableFleet.length} within range):
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {availableFleet.slice(0, 8).map((v, i) => (
                <div key={v.vehicle_id || i} className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 w-24 flex-shrink-0">
                    {v.is_refrigerated
                      ? <Snowflake className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                      : <Truck className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    }
                    <span className="text-slate-300 capitalize">{v.vehicle_type}</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 flex-1 min-w-0">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{v.current_location ?? 'Unknown'}</span>
                  </div>
                  {v.distance_km !== undefined && (
                    <span className="text-slate-400 flex-shrink-0">{v.distance_km.toFixed(0)} km</span>
                  )}
                  {v.reposition_hours !== undefined && (
                    <span className="text-slate-500 flex-shrink-0">{v.reposition_hours.toFixed(1)}h</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cold-chain fleet */}
        {coldChainFleet.length > 0 && (
          <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg p-3">
            <p className="text-xs font-medium text-cyan-300 mb-2 flex items-center gap-1.5">
              <Snowflake className="w-3.5 h-3.5" />
              {coldChainFleet.length} refrigerated vehicles available near disruption
            </p>
            <div className="space-y-1">
              {coldChainFleet.slice(0, 4).map((v, i) => (
                <div key={v.vehicle_id || i} className="flex justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {v.current_location ?? 'Unknown'}
                  </span>
                  <span>{v.reposition_cost_inr !== undefined ? formatCurrency(v.reposition_cost_inr) : '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FleetKpi({
  label, value, total, color,
}: {
  label: string;
  value: number;
  total: number;
  color: 'green' | 'orange' | 'cyan' | 'blue';
}) {
  const colorMap = {
    green: 'text-green-400',
    orange: 'text-orange-400',
    cyan: 'text-cyan-400',
    blue: 'text-blue-400',
  };
  return (
    <div className="bg-slate-750 border border-slate-700 rounded-lg p-2.5 text-center">
      <p className={`text-lg font-bold ${colorMap[color]}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xs text-slate-600">of {total}</p>
    </div>
  );
}
