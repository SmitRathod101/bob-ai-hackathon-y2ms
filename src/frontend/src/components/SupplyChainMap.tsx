import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline } from 'react-leaflet';
import type { Port } from '../services/api';

interface SupplyChainMapProps {
  ports: Port[];
  disruptedPortIds: string[];
  disruptedRouteIds: string[];
  simulationResult?: {
    scenario?: { location?: string };
    impact_summary?: { disrupted_routes?: number };
  } | null;
}

// Route segments with metadata about which cities are endpoints
const ROUTE_PATHS: Array<{
  id: string;
  path: [number, number][];
  label: string;
  cities: string[]; // lowercase city names involved
}> = [
  { id: 'r1',  path: [[18.922, 72.835], [18.520, 73.857]], label: 'Mumbai–Pune',               cities: ['mumbai','pune'] },
  { id: 'r2',  path: [[18.922, 72.835], [23.022, 72.571]], label: 'Mumbai–Ahmedabad',           cities: ['mumbai','ahmedabad'] },
  { id: 'r3',  path: [[18.922, 72.835], [28.614, 77.209]], label: 'Mumbai–Delhi',               cities: ['mumbai','delhi'] },
  { id: 'r4',  path: [[18.922, 72.835], [12.972, 77.595]], label: 'Mumbai–Bengaluru',           cities: ['mumbai','bengaluru'] },
  { id: 'r5',  path: [[18.922, 72.835], [17.385, 78.487]], label: 'Mumbai–Hyderabad',           cities: ['mumbai','hyderabad'] },
  { id: 'r6',  path: [[18.922, 72.835], [21.170, 72.831]], label: 'Mumbai–Surat',               cities: ['mumbai','surat'] },
  { id: 'r7',  path: [[18.922, 72.835], [21.146, 79.088]], label: 'Mumbai–Nagpur',              cities: ['mumbai','nagpur'] },
  { id: 'r8',  path: [[18.951, 72.949], [28.614, 77.209]], label: 'JNPT–Delhi',                 cities: ['jnpt','delhi'] },
  { id: 'r9',  path: [[18.951, 72.949], [18.520, 73.857]], label: 'JNPT–Pune',                  cities: ['jnpt','pune'] },
  { id: 'r10', path: [[22.839, 69.722], [23.022, 72.571]], label: 'Mundra–Ahmedabad',           cities: ['mundra','ahmedabad'] },
  { id: 'r11', path: [[22.839, 69.722], [28.614, 77.209]], label: 'Mundra–Delhi',               cities: ['mundra','delhi'] },
  { id: 'r12', path: [[22.839, 69.722], [18.922, 72.835]], label: 'Mundra–Mumbai',              cities: ['mundra','mumbai'] },
  { id: 'r13', path: [[23.033, 70.217], [23.022, 72.571]], label: 'Kandla–Ahmedabad',           cities: ['kandla','ahmedabad'] },
  { id: 'r14', path: [[13.084, 80.293], [12.972, 77.595]], label: 'Chennai–Bengaluru',          cities: ['chennai','bengaluru'] },
  { id: 'r15', path: [[13.084, 80.293], [17.385, 78.487]], label: 'Chennai–Hyderabad',          cities: ['chennai','hyderabad'] },
  { id: 'r16', path: [[22.573, 88.364], [28.614, 77.209]], label: 'Kolkata–Delhi',              cities: ['kolkata','delhi'] },
  { id: 'r17', path: [[22.573, 88.364], [17.385, 78.487]], label: 'Kolkata–Hyderabad',          cities: ['kolkata','hyderabad'] },
  { id: 'r18', path: [[9.931,  76.267], [12.972, 77.595]], label: 'Kochi–Bengaluru',            cities: ['kochi','bengaluru'] },
  { id: 'r19', path: [[9.931,  76.267], [13.084, 80.293]], label: 'Kochi–Chennai',              cities: ['kochi','chennai'] },
  { id: 'r20', path: [[17.687, 83.219], [17.385, 78.487]], label: 'Visakhapatnam–Hyderabad',   cities: ['visakhapatnam','hyderabad'] },
  { id: 'r21', path: [[28.614, 77.209], [26.912, 75.787]], label: 'Delhi–Jaipur',               cities: ['delhi','jaipur'] },
  { id: 'r22', path: [[28.614, 77.209], [26.847, 80.946]], label: 'Delhi–Lucknow',              cities: ['delhi','lucknow'] },
  { id: 'r23', path: [[28.614, 77.209], [23.022, 72.571]], label: 'Delhi–Ahmedabad',            cities: ['delhi','ahmedabad'] },
  { id: 'r24', path: [[17.385, 78.487], [21.146, 79.088]], label: 'Hyderabad–Nagpur',           cities: ['hyderabad','nagpur'] },
  { id: 'r25', path: [[18.520, 73.857], [12.972, 77.595]], label: 'Pune–Bengaluru',             cities: ['pune','bengaluru'] },
  // Rail routes (slightly different y-offset so they visually separate)
  { id: 'r26', path: [[18.88, 72.88], [28.55, 77.15]],    label: 'Mumbai–Delhi (Rail)',        cities: ['mumbai','delhi'] },
  { id: 'r27', path: [[22.78, 69.68], [28.55, 77.15]],    label: 'Mundra–Delhi (Rail)',        cities: ['mundra','delhi'] },
  { id: 'r28', path: [[13.04, 80.24], [28.55, 77.15]],    label: 'Chennai–Delhi (Rail)',       cities: ['chennai','delhi'] },
];

export default function SupplyChainMap({
  ports,
  disruptedPortIds,
  simulationResult,
}: SupplyChainMapProps) {
  // Derive the disrupted city name (lowercased) from the scenario location
  const rawLocation = simulationResult?.scenario?.location ?? '';
  const disruptedCities = new Set<string>();
  const locLower = rawLocation.toLowerCase()
    .replace(' port', '')
    .replace('jnpt', 'jnpt')
    .trim();
  if (locLower) disruptedCities.add(locLower);
  // Also add the ID-based ones
  disruptedPortIds.forEach(id => {
    const portName = id.toLowerCase().replace(' port', '').trim();
    disruptedCities.add(portName);
  });

  const isRouteDisrupted = (route: typeof ROUTE_PATHS[0]) =>
    route.cities.some(c => disruptedCities.has(c));

  const hasSimulation = !!simulationResult && disruptedCities.size > 0;
  const disruptedRouteCount = ROUTE_PATHS.filter(r => isRouteDisrupted(r)).length;

  return (
    <div className="card overflow-hidden">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-200">India Logistics Network</h3>
          {hasSimulation && (
            <span className="text-xs bg-red-900/40 text-red-300 border border-red-700 px-2 py-0.5 rounded-full animate-pulse">
              DISRUPTION ACTIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
            Port
          </span>
          {hasSimulation && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              Disrupted ({disruptedRouteCount} routes)
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />
            High congestion
          </span>
        </div>
      </div>
      <div style={{ height: 420 }}>
        <MapContainer
          center={[20.5, 78.5]}
          zoom={5}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution=""
          />

          {/* Routes — normal first (z-order: disrupted on top) */}
          {ROUTE_PATHS.filter(r => !isRouteDisrupted(r)).map(route => (
            <Polyline
              key={route.id}
              positions={route.path}
              pathOptions={{
                color: '#3b82f6',
                weight: route.id.startsWith('r2') ? 1 : 1.5,
                opacity: 0.4,
              }}
            >
              <Tooltip sticky>{route.label}</Tooltip>
            </Polyline>
          ))}

          {/* Disrupted routes — drawn on top with warning styling */}
          {hasSimulation && ROUTE_PATHS.filter(r => isRouteDisrupted(r)).map(route => (
            <Polyline
              key={`disrupted-${route.id}`}
              positions={route.path}
              pathOptions={{
                color: '#ef4444',
                weight: 3,
                opacity: 0.9,
                dashArray: '8, 6',
              }}
            >
              <Tooltip sticky>
                <div className="text-xs font-semibold text-red-600">
                  ⚠ BLOCKED: {route.label}
                </div>
              </Tooltip>
            </Polyline>
          ))}

          {/* Ports */}
          {ports.map(port => {
            const portCityLower = port.city.toLowerCase();
            const portNameLower = port.name.toLowerCase().replace(' port', '').trim();
            const isDisrupted = disruptedCities.has(portCityLower) ||
              disruptedCities.has(portNameLower) ||
              disruptedCities.has(port.port_id.toLowerCase());

            return (
              <CircleMarker
                key={port.port_id}
                center={[port.latitude, port.longitude]}
                radius={isDisrupted ? 15 : port.congestion > 0.65 ? 11 : 9}
                pathOptions={{
                  fillColor: isDisrupted ? '#ef4444'
                    : port.congestion > 0.65 ? '#f97316'
                    : '#3b82f6',
                  fillOpacity: 0.9,
                  color: isDisrupted ? '#fca5a5'
                    : port.congestion > 0.65 ? '#fed7aa'
                    : '#93c5fd',
                  weight: isDisrupted ? 2.5 : 1,
                }}
              >
                <Tooltip permanent={isDisrupted}>
                  <div style={{ fontSize: 11 }}>
                    <strong style={{ color: isDisrupted ? '#ef4444' : '#1e40af' }}>
                      {isDisrupted ? '🔴 ' : ''}{port.name}
                    </strong>
                    <br />
                    Congestion: {Math.round(port.congestion * 100)}%
                    {isDisrupted && <><br /><strong style={{ color: '#ef4444' }}>DISRUPTED</strong></>}
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
