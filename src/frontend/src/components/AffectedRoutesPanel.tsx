import { Route, AlertTriangle, Clock } from 'lucide-react';

interface AffectedRoutesPanelProps {
  disruptedRouteIds: string[];
  disruptedLocation: string;
  disrupted_routes_count: number;
}

function routeToLabel(routeId: string): string {
  // ROUTE_MUMB_PUNE_T_001 → Mumbai → Pune
  const parts = routeId.split('_');
  if (parts.length >= 3) {
    const from = parts[1];
    const to = parts[2];
    return `${from.charAt(0) + from.slice(1).toLowerCase()} → ${to.charAt(0) + to.slice(1).toLowerCase()}`;
  }
  return routeId;
}

export default function AffectedRoutesPanel({
  disruptedRouteIds,
  disruptedLocation,
  disrupted_routes_count,
}: AffectedRoutesPanelProps) {
  if (!disruptedRouteIds || disruptedRouteIds.length === 0) return null;

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-semibold text-gray-800">Disrupted Routes</h3>
          <span className="badge badge-critical text-xs">{disrupted_routes_count} blocked</span>
        </div>
        <span className="text-xs text-gray-400">All routes via {disruptedLocation}</span>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
          {disruptedRouteIds.slice(0, 20).map(routeId => (
            <div
              key={routeId}
              className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
              <span className="text-xs text-gray-700 font-mono truncate" title={routeId}>
                {routeToLabel(routeId)}
              </span>
              <span className="text-xs text-red-600 font-medium ml-auto flex-shrink-0">BLOCKED</span>
            </div>
          ))}
        </div>
        {disruptedRouteIds.length > 20 && (
          <p className="text-xs text-gray-400 mt-2 text-center">
            +{disruptedRouteIds.length - 20} more routes blocked
          </p>
        )}
        <div className="mt-3 flex items-start gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
          <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
          All shipments using these routes have been rerouted through available alternative paths.
          Alternative routes may have higher congestion and cost.
        </div>
      </div>
    </div>
  );
}
