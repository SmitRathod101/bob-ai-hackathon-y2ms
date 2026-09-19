/**
 * RouteDetailPanel — Detail view for a selected route/connection node
 * Uses real Route + Shipment data. No mock data.
 */

import { useState, useEffect } from 'react';
import type { Route } from '../services/api';
import { getRoutes, getShipments } from '../services/api';
import { formatCurrency } from '../utils/format';
import {
  Network, MapPin, AlertTriangle, CheckCircle2,
  Loader2, Truck, ArrowRight, Zap, BarChart3,
} from 'lucide-react';

interface RouteDetailPanelProps {
  nodeName: string;          // clicked node / port name
  onNavigate: (section: string) => void;
  onClose: () => void;
}

export default function RouteDetailPanel({
  nodeName,
  onNavigate,
  onClose,
}: RouteDetailPanelProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [affectedCount, setAffectedCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getRoutes(true),
      getShipments({ limit: 200 }),
    ])
      .then(([allRoutes, shipmentData]) => {
        if (cancelled) return;
        // Filter routes involving this node
        const nodeRoutes = allRoutes.filter(
          r => r.origin === nodeName || r.destination === nodeName
        );
        setRoutes(nodeRoutes);
        // Count shipments with this origin or destination
        const count = shipmentData.shipments.filter(
          s => s.origin === nodeName || s.destination === nodeName
        ).length;
        setAffectedCount(count);
      })
      .catch(e => {
        if (!cancelled) setError(e.message ?? 'Failed to load route data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [nodeName]);

  const highRiskRoutes = routes.filter(r => r.risk_score >= 0.5);
  const disrupted = routes.filter(r => !r.is_active);

  return (
    <div className="space-y-0">
      {/* Status strip */}
      <div className={`px-5 py-3 flex items-center gap-3 border-b ${
        disrupted.length > 0 ? 'bg-red-50 border-red-100' :
        highRiskRoutes.length > 0 ? 'bg-amber-50 border-amber-100' :
        'bg-emerald-50 border-emerald-100'
      }`}>
        {disrupted.length > 0
          ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          : highRiskRoutes.length > 0
          ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          : <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        }
        <span className={`text-sm font-medium ${
          disrupted.length > 0 ? 'text-red-800' :
          highRiskRoutes.length > 0 ? 'text-amber-800' : 'text-emerald-800'
        }`}>
          {disrupted.length > 0
            ? `${disrupted.length} disrupted route${disrupted.length > 1 ? 's' : ''}`
            : highRiskRoutes.length > 0
            ? `${highRiskRoutes.length} high-risk route${highRiskRoutes.length > 1 ? 's' : ''}`
            : 'All routes operational'
          }
        </span>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Node summary */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-base font-semibold text-slate-900">{nodeName}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {routes.length} connected routes · {affectedCount} active shipments
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading route data…
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            {error}
          </div>
        )}

        {/* Routes list */}
        {!loading && routes.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Connected Routes ({routes.length})
            </div>
            <div className="space-y-2">
              {routes.map(route => {
                const riskHigh = route.risk_score >= 0.5;
                const congHigh = route.congestion > 0.65;
                return (
                  <div
                    key={route.route_id}
                    className={`rounded-xl p-3 border text-sm ${
                      !route.is_active ? 'bg-red-50 border-red-200' :
                      riskHigh      ? 'bg-amber-50 border-amber-200' :
                                      'bg-white border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Network className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-slate-800 flex-1 truncate">
                        {route.origin} → {route.destination}
                      </span>
                      <span className={`text-[10px] font-semibold border rounded px-1.5 py-0.5 capitalize ${
                        !route.is_active    ? 'bg-red-50 text-red-700 border-red-200' :
                        riskHigh            ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {!route.is_active ? 'Disrupted' : riskHigh ? 'At risk' : 'Active'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-slate-400">Mode</span>
                        <span className="capitalize font-medium text-slate-700">{route.transport_mode}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-slate-400">Risk</span>
                        <span className={`font-semibold ${riskHigh ? 'text-red-600' : 'text-slate-700'}`}>
                          {Math.round(route.risk_score * 100)}%
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-slate-400">Congestion</span>
                        <span className={`font-semibold ${congHigh ? 'text-amber-600' : 'text-slate-700'}`}>
                          {Math.round(route.congestion * 100)}%
                        </span>
                      </div>
                    </div>
                    {route.distance_km > 0 && (
                      <div className="mt-1.5 text-xs text-slate-400">
                        {route.distance_km.toLocaleString()} km · {route.normal_time_hours}h normal transit ·{' '}
                        {formatCurrency(route.cost_per_km * route.distance_km)} est. cost
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && routes.length === 0 && (
          <div className="text-center py-6 text-slate-400">
            <Network className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No routes found for {nodeName}</p>
            <p className="text-xs mt-1">Backend may not have route data for this node</p>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-slate-100 pt-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Actions</div>
          <div className="space-y-2">
            <button
              onClick={() => { onNavigate('network'); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <ArrowRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <div>
                <div className="font-medium">View Full Network</div>
                <div className="text-xs text-slate-400">All routes and connections</div>
              </div>
            </button>
            <button
              onClick={() => { onNavigate('shipments'); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <Truck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <div>
                <div className="font-medium">View Affected Shipments</div>
                <div className="text-xs text-slate-400">{affectedCount} shipments through {nodeName}</div>
              </div>
            </button>
            {(highRiskRoutes.length > 0 || disrupted.length > 0) && (
              <button
                onClick={() => { onNavigate('crisis-simulator'); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 hover:bg-amber-100 transition-colors text-left"
              >
                <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div>
                  <div className="font-medium">Simulate Disruption</div>
                  <div className="text-xs text-amber-600">Model a crisis scenario at {nodeName}</div>
                </div>
              </button>
            )}
            <button
              onClick={() => { onNavigate('network-health'); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <BarChart3 className="w-4 h-4 text-purple-500 flex-shrink-0" />
              <div>
                <div className="font-medium">Network Health</div>
                <div className="text-xs text-slate-400">Full network risk overview</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
