import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline } from 'react-leaflet';
import type { Port } from '../services/api';

interface SupplyChainMapProps {
  ports: Port[];
  disruptedPortIds: string[];
  disruptedRouteIds: string[];
  simulationResult?: {
    scenario?: { location?: string };
  } | null;
}

// Major routes as lat/lon pairs for visualization
const ROUTE_PATHS: Array<{ id: string; path: [number, number][]; label: string }> = [
  { id: 'r1', path: [[18.922, 72.835], [18.520, 73.857]], label: 'Mumbai–Pune' },
  { id: 'r2', path: [[18.922, 72.835], [23.022, 72.571]], label: 'Mumbai–Ahmedabad' },
  { id: 'r3', path: [[18.922, 72.835], [28.614, 77.209]], label: 'Mumbai–Delhi' },
  { id: 'r4', path: [[18.922, 72.835], [12.972, 77.595]], label: 'Mumbai–Bengaluru' },
  { id: 'r5', path: [[18.922, 72.835], [17.385, 78.487]], label: 'Mumbai–Hyderabad' },
  { id: 'r6', path: [[22.839, 69.722], [23.022, 72.571]], label: 'Mundra–Ahmedabad' },
  { id: 'r7', path: [[22.839, 69.722], [28.614, 77.209]], label: 'Mundra–Delhi' },
  { id: 'r8', path: [[13.084, 80.293], [12.972, 77.595]], label: 'Chennai–Bengaluru' },
  { id: 'r9', path: [[13.084, 80.293], [17.385, 78.487]], label: 'Chennai–Hyderabad' },
  { id: 'r10', path: [[22.573, 88.364], [28.614, 77.209]], label: 'Kolkata–Delhi' },
  { id: 'r11', path: [[28.614, 77.209], [26.912, 75.787]], label: 'Delhi–Jaipur' },
  { id: 'r12', path: [[28.614, 77.209], [26.847, 80.946]], label: 'Delhi–Lucknow' },
  { id: 'r13', path: [[17.687, 83.219], [17.385, 78.487]], label: 'Visakhapatnam–Hyderabad' },
  { id: 'r14', path: [[9.931, 76.267], [12.972, 77.595]], label: 'Kochi–Bengaluru' },
  { id: 'r15', path: [[18.951, 72.949], [28.614, 77.209]], label: 'JNPT–Delhi' },
];

export default function SupplyChainMap({
  ports,
  disruptedPortIds,
  disruptedRouteIds,
  simulationResult,
}: SupplyChainMapProps) {
  const disruptedLocation = simulationResult?.scenario?.location?.toLowerCase() ?? '';

  return (
    <div className="card overflow-hidden">
      <div className="card-header flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">India Logistics Network</h3>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Port</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Disrupted</span>
          <span className="flex items-center gap-1"><span className="w-6 border-b border-slate-400 inline-block" /> Route</span>
        </div>
      </div>
      <div style={{ height: 420 }}>
        <MapContainer
          center={[20.0, 78.5]}
          zoom={5}
          style={{ height: '100%', width: '100%', background: '#0f172a' }}
          zoomControl={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution=""
          />

          {/* Routes */}
          {ROUTE_PATHS.map(route => {
            const isDisrupted = disruptedRouteIds.some(_id =>
              route.label.toLowerCase().includes(disruptedLocation)
            );
            return (
              <Polyline
                key={route.id}
                positions={route.path}
                pathOptions={{
                  color: isDisrupted ? '#ef4444' : '#3b82f6',
                  weight: isDisrupted ? 3 : 1.5,
                  opacity: isDisrupted ? 0.9 : 0.5,
                  dashArray: isDisrupted ? '5, 5' : undefined,
                }}
              >
                <Tooltip sticky>{route.label}</Tooltip>
              </Polyline>
            );
          })}

          {/* Ports */}
          {ports.map(port => {
            const isDisrupted = disruptedPortIds.includes(port.port_id) ||
              port.name.toLowerCase().includes(disruptedLocation) ||
              port.city.toLowerCase().includes(disruptedLocation);
            return (
              <CircleMarker
                key={port.port_id}
                center={[port.latitude, port.longitude]}
                radius={isDisrupted ? 14 : 9}
                pathOptions={{
                  fillColor: isDisrupted ? '#ef4444' : port.congestion > 0.65 ? '#f97316' : '#3b82f6',
                  fillOpacity: 0.85,
                  color: isDisrupted ? '#fca5a5' : '#93c5fd',
                  weight: isDisrupted ? 2 : 1,
                }}
              >
                <Tooltip permanent={isDisrupted} sticky>
                  <div className="text-xs">
                    <strong>{port.name}</strong><br />
                    Congestion: {Math.round(port.congestion * 100)}%<br />
                    Status: {isDisrupted ? '🔴 DISRUPTED' : port.operational_status}
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
