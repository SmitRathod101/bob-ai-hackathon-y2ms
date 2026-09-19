/**
 * DigitalTwin — Animated Supply Chain Network Visualization
 *
 * Renders the full India logistics network as a live, animated SVG digital twin.
 * Connects to /api/twin/state for real network data.
 * Shows trucks/shipments moving along routes, disruptions, recovery paths.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getTwinState, type TwinState, type TwinConnection } from '../services/api';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Zap, Truck, ArrowUpRight, Shield } from 'lucide-react';

// ── SVG Canvas Dimensions ─────────────────────────────────────────────────────
const W = 800;
const H = 520;

// ── Geo→SVG Projection (India bounding box) ───────────────────────────────────
const GEO = { minLat: 7.5, maxLat: 31.5, minLon: 67.0, maxLon: 92.0 };
const PAD = { top: 30, right: 20, bottom: 25, left: 20 };

function project(lat: number, lon: number): [number, number] {
  const x = PAD.left + ((lon - GEO.minLon) / (GEO.maxLon - GEO.minLon)) * (W - PAD.left - PAD.right);
  // SVG y-axis is inverted (top = low lat, bottom = high lat → flip)
  const y = PAD.top + (1 - (lat - GEO.minLat) / (GEO.maxLat - GEO.minLat)) * (H - PAD.top - PAD.bottom);
  return [x, y];
}

// ── Static network node coords (must match backend NODE_COORDS) ──────────────
const STATIC_NODES: Record<string, { lat: number; lon: number; type: 'port' | 'city' | 'warehouse' }> = {
  "Mumbai":        { lat: 18.922, lon: 72.835, type: "port" },
  "JNPT":          { lat: 18.951, lon: 72.949, type: "port" },
  "Mundra":        { lat: 22.839, lon: 69.722, type: "port" },
  "Kandla":        { lat: 23.033, lon: 70.217, type: "port" },
  "Ahmedabad":     { lat: 23.022, lon: 72.571, type: "city" },
  "Surat":         { lat: 21.170, lon: 72.831, type: "city" },
  "Delhi":         { lat: 28.614, lon: 77.209, type: "city" },
  "Jaipur":        { lat: 26.912, lon: 75.787, type: "city" },
  "Lucknow":       { lat: 26.847, lon: 80.946, type: "city" },
  "Nagpur":        { lat: 21.146, lon: 79.088, type: "city" },
  "Hyderabad":     { lat: 17.385, lon: 78.487, type: "city" },
  "Chennai":       { lat: 13.084, lon: 80.293, type: "port" },
  "Bengaluru":     { lat: 12.972, lon: 77.595, type: "city" },
  "Kochi":         { lat: 9.931,  lon: 76.267, type: "port" },
  "Kolkata":       { lat: 22.573, lon: 88.364, type: "port" },
  "Visakhapatnam": { lat: 17.687, lon: 83.219, type: "port" },
  "Pune":          { lat: 18.520, lon: 73.857, type: "city" },
};

// ── Static connection definitions (always drawn even without backend data) ───
const STATIC_CONNECTIONS: Array<{ from: string; to: string; mode: string }> = [
  { from: "Mumbai",    to: "Pune",          mode: "truck" },
  { from: "Mumbai",    to: "Ahmedabad",     mode: "truck" },
  { from: "Mumbai",    to: "Delhi",         mode: "truck" },
  { from: "Mumbai",    to: "Bengaluru",     mode: "truck" },
  { from: "Mumbai",    to: "Hyderabad",     mode: "truck" },
  { from: "Mumbai",    to: "Surat",         mode: "truck" },
  { from: "Mumbai",    to: "Nagpur",        mode: "truck" },
  { from: "JNPT",      to: "Delhi",         mode: "truck" },
  { from: "JNPT",      to: "Pune",          mode: "truck" },
  { from: "Mundra",    to: "Ahmedabad",     mode: "truck" },
  { from: "Mundra",    to: "Delhi",         mode: "truck" },
  { from: "Kandla",    to: "Ahmedabad",     mode: "truck" },
  { from: "Chennai",   to: "Bengaluru",     mode: "truck" },
  { from: "Chennai",   to: "Hyderabad",     mode: "truck" },
  { from: "Kolkata",   to: "Delhi",         mode: "truck" },
  { from: "Kolkata",   to: "Hyderabad",     mode: "truck" },
  { from: "Kochi",     to: "Bengaluru",     mode: "truck" },
  { from: "Kochi",     to: "Chennai",       mode: "truck" },
  { from: "Visakhapatnam", to: "Hyderabad", mode: "truck" },
  { from: "Delhi",     to: "Jaipur",        mode: "truck" },
  { from: "Delhi",     to: "Lucknow",       mode: "truck" },
  { from: "Hyderabad", to: "Nagpur",        mode: "truck" },
  { from: "Pune",      to: "Bengaluru",     mode: "truck" },
  // Rail routes
  { from: "Mumbai",    to: "Delhi",         mode: "rail" },
  { from: "Chennai",   to: "Delhi",         mode: "rail" },
  { from: "Mundra",    to: "Delhi",         mode: "rail" },
];

// ── Colour helpers ────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  normal:    '#22c55e',
  warning:   '#f59e0b',
  crisis:    '#ef4444',
  recovery:  '#a78bfa',
  recovered: '#34d399',
};

const NODE_FILL: Record<string, string> = {
  port:      '#3b82f6',
  city:      '#22d3ee',
  warehouse: '#8b5cf6',
};

// ── Animated truck dot ────────────────────────────────────────────────────────
interface TruckDot {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  t: number;            // 0..1 animation progress
  speed: number;        // progress per frame
  color: string;
  isAffected: boolean;
  label: string;
  connectionStatus: string;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  /** When provided (from Manual/Auto mode), forces a refresh of twin state */
  refreshTrigger?: number;
  /** Optional: pass in simulation result disrupted route IDs to highlight immediately */
  disruptedRouteIds?: string[];
  /** Optional: alternative route IDs to highlight */
  alternativeRouteIds?: string[];
  /** Optional: current simulation location to highlight node */
  activeLocation?: string;
  compact?: boolean;
  /**
   * When true the component renders as a bare SVG panel (no card chrome).
   * Use this when the parent already provides a card + header.
   */
  headerless?: boolean;
  /** Optional: callback when a node is clicked — receives node name */
  onNodeClick?: (nodeName: string) => void;
}

export default function DigitalTwin({
  refreshTrigger,
  disruptedRouteIds = [],
  alternativeRouteIds = [],
  activeLocation,
  compact = false,
  headerless = false,
  onNodeClick,
}: Props) {
  const [twinState, setTwinState] = useState<TwinState | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [trucks, setTrucks] = useState<TruckDot[]>([]);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const animRef = useRef<number | null>(null);
  const trucksRef = useRef<TruckDot[]>([]);

  // ── Load twin state ──────────────────────────────────────────────────────────
  const loadState = useCallback(async () => {
    try {
      const state = await getTwinState();
      setTwinState(state);
      setLastUpdated(new Date());
    } catch {
      // silently ignore, show stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
    const timer = setInterval(loadState, 15_000); // poll every 15s
    return () => clearInterval(timer);
  }, [loadState]);

  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadState();
    }
  }, [refreshTrigger, loadState]);

  // ── Build truck animations from shipments ────────────────────────────────────
  useEffect(() => {
    if (!twinState) return;

    // Build node→position map
    const nodePos: Record<string, [number, number]> = {};
    for (const [name, info] of Object.entries(STATIC_NODES)) {
      nodePos[name] = project(info.lat, info.lon);
    }
    // Also add from twinState.nodes for any extra nodes
    for (const n of twinState.nodes) {
      if (!nodePos[n.name] && n.lat && n.lon) {
        nodePos[n.name] = project(n.lat, n.lon);
      }
    }

    // Determine which connections are disrupted
    const disruptedSet = new Set<string>([
      ...disruptedRouteIds,
      ...twinState.simulation.disrupted_route_ids ?? [],
    ]);
    // Create a connection status lookup by node pair
    const connStatus: Map<string, string> = new Map();
    for (const c of twinState.connections) {
      const key = `${c.from}→${c.to}`;
      connStatus.set(key, c.status);
      if (c.route_id && disruptedSet.has(c.route_id)) {
        connStatus.set(key, 'unavailable');
      }
    }

    // Create truck dots for each in-transit / delayed shipment
    const newTrucks: TruckDot[] = [];
    const shipmentSubset = twinState.shipments
      .filter(s => ['in_transit', 'delayed', 'at_port'].includes(s.status))
      .slice(0, 30); // cap for performance

    for (const s of shipmentSubset) {
      const p1 = nodePos[s.origin];
      const p2 = nodePos[s.destination];
      if (!p1 || !p2) continue;

      const cKey = `${s.origin}→${s.destination}`;
      const cStatus = connStatus.get(cKey) ?? 'available';

      // colour by risk level
      const colors: Record<string, string> = {
        low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
      };
      const color = s.is_affected ? '#ef4444' : (colors[s.risk_level] ?? '#3b82f6');

      // initial progress from DB, then animate from there
      const initT = Math.max(0, Math.min(1, s.progress_pct / 100));

      newTrucks.push({
        id: s.id,
        x1: p1[0], y1: p1[1],
        x2: p2[0], y2: p2[1],
        t: initT,
        speed: s.is_affected ? 0.0008 : 0.0015 + Math.random() * 0.001,
        color,
        isAffected: s.is_affected,
        label: `${s.id.slice(-6)} · ${s.cargo_type ?? 'Cargo'}`,
        connectionStatus: cStatus,
      });
    }

    // Add some "background" trucks for non-disrupted routes to show life
    const activeConns = STATIC_CONNECTIONS.filter(c => {
      const key = `${c.from}→${c.to}`;
      return connStatus.get(key) !== 'unavailable' && c.mode !== 'rail';
    }).slice(0, 10);

    for (let i = 0; i < Math.min(activeConns.length, 6); i++) {
      const c = activeConns[i];
      const p1 = nodePos[c.from];
      const p2 = nodePos[c.to];
      if (!p1 || !p2) continue;
      newTrucks.push({
        id: `bg_${i}`,
        x1: p1[0], y1: p1[1],
        x2: p2[0], y2: p2[1],
        t: Math.random(),
        speed: 0.0012 + Math.random() * 0.0008,
        color: '#60a5fa',
        isAffected: false,
        label: 'Transit truck',
        connectionStatus: 'available',
      });
    }

    trucksRef.current = newTrucks;
    setTrucks([...newTrucks]);
  }, [twinState, disruptedRouteIds, alternativeRouteIds]);

  // ── Animation loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const animate = () => {
      trucksRef.current = trucksRef.current.map(t => {
        if (t.connectionStatus === 'unavailable') {
          // stall in place — simulate disrupted shipment
          return t;
        }
        let next = t.t + t.speed;
        if (next > 1) next = 0; // loop
        return { ...t, t: next };
      });
      setTrucks([...trucksRef.current]);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const health = twinState?.network_health ?? 'normal';
  const healthColor = STATUS_COLORS[health] ?? '#22c55e';
  const healthLabel = {
    normal:    '● Normal Operation',
    warning:   '⚠ Warning',
    crisis:    '⛔ Crisis Active',
    recovery:  '↺ Recovery in Progress',
    recovered: '✓ Recovered',
  }[health] ?? '● Normal';

  // Determine which node names are disrupted
  const disruptedNodeNames = new Set<string>();
  if (activeLocation) disruptedNodeNames.add(activeLocation.toLowerCase().replace(' port', ''));
  if (twinState?.simulation?.location) {
    disruptedNodeNames.add(twinState.simulation.location.toLowerCase().replace(' port', ''));
  }
  twinState?.connections
    .filter(c => c.status === 'unavailable')
    .forEach(c => {
      disruptedNodeNames.add(c.from.toLowerCase());
      disruptedNodeNames.add(c.to.toLowerCase());
    });

  // Compute connection paint properties
  const getConnPaint = (c: TwinConnection | { from: string; to: string; mode: string }) => {
    const fromKey = 'from' in c ? c.from : '';
    const toKey = 'to' in c ? c.to : '';

    // Check if disrupted via twinState connections
    const matched = twinState?.connections.find(
      tc => tc.from === fromKey && tc.to === toKey
    );
    const status = matched?.status ?? 'available';
    const isAlt = matched?.is_alternative ?? false;

    if (status === 'unavailable') {
      return { stroke: '#ef4444', opacity: 0.9, dashArray: '8 6', width: 2.5 };
    }
    if (isAlt) {
      return { stroke: '#a78bfa', opacity: 0.9, dashArray: '6 3', width: 2.5 };
    }
    if (status === 'degraded') {
      return { stroke: '#f59e0b', opacity: 0.7, dashArray: '4 4', width: 1.5 };
    }
    const isRail = ('mode' in c && c.mode === 'rail') || (matched?.mode === 'rail');
    return {
      stroke: isRail ? '#818cf8' : '#3b82f6',
      opacity: isRail ? 0.3 : 0.25,
      dashArray: isRail ? '4 3' : 'none',
      width: isRail ? 1 : 1.5,
    };
  };

  const svgHeight = compact ? 380 : H;

  /** The SVG canvas + tooltip — shared between card and headerless modes */
  const svgCanvas = (
    <div className="relative flex-1 min-h-0 overflow-hidden" style={{ background: '#0a1628' }}>
        {loading && !twinState && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="loading-spinner mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading digital twin...</p>
            </div>
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${svgHeight}`}
          style={{ width: '100%', height: '100%', minHeight: svgHeight, display: 'block' }}
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setTooltip(null)}
        >
          {/* India outline (simplified grid for context) */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={W} height={svgHeight} fill="url(#grid)" opacity="0.4" />

          {/* ── Connections ─────────────────────────────────────────── */}
          {STATIC_CONNECTIONS.map((c, i) => {
            const p1 = project(STATIC_NODES[c.from]?.lat, STATIC_NODES[c.from]?.lon);
            const p2 = project(STATIC_NODES[c.to]?.lat, STATIC_NODES[c.to]?.lon);
            if (!STATIC_NODES[c.from] || !STATIC_NODES[c.to]) return null;

            const paint = getConnPaint(c as TwinConnection);
            const isDisrupted = paint.stroke === '#ef4444';
            const isAlt = paint.stroke === '#a78bfa';

            return (
              <g key={`conn-${i}`}>
                <line
                  x1={p1[0]} y1={p1[1]}
                  x2={p2[0]} y2={p2[1]}
                  stroke={paint.stroke}
                  strokeWidth={paint.width}
                  strokeOpacity={paint.opacity}
                  strokeDasharray={paint.dashArray === 'none' ? undefined : paint.dashArray}
                />
                {/* Glow for disrupted/alternative */}
                {(isDisrupted || isAlt) && (
                  <line
                    x1={p1[0]} y1={p1[1]}
                    x2={p2[0]} y2={p2[1]}
                    stroke={paint.stroke}
                    strokeWidth={paint.width + 4}
                    strokeOpacity={0.12}
                    strokeDasharray={paint.dashArray === 'none' ? undefined : paint.dashArray}
                  />
                )}
              </g>
            );
          })}

          {/* ── Animated truck dots ──────────────────────────────────── */}
          {trucks.map(truck => {
            const x = truck.x1 + (truck.x2 - truck.x1) * truck.t;
            const y = truck.y1 + (truck.y2 - truck.y1) * truck.t;
            const stalled = truck.connectionStatus === 'unavailable';
            return (
              <g key={truck.id}>
                {/* Glow for affected trucks */}
                {truck.isAffected && (
                  <circle cx={x} cy={y} r={7} fill={truck.color} opacity={0.2} />
                )}
                <circle
                  cx={x} cy={y} r={stalled ? 4 : 3}
                  fill={stalled ? '#ef4444' : truck.color}
                  opacity={stalled ? 0.9 : 0.85}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const parentRect = (e.currentTarget.closest('.relative') as HTMLElement)?.getBoundingClientRect();
                    setTooltip({
                      text: stalled
                        ? `⚠ STALLED: ${truck.label}`
                        : `🚛 ${truck.label}`,
                      x: e.clientX - (parentRect?.left ?? 0),
                      y: e.clientY - (parentRect?.top ?? 0),
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
                {stalled && (
                  <text x={x + 5} y={y - 5} fill="#ef4444" fontSize="8" fontWeight="bold">!</text>
                )}
              </g>
            );
          })}

          {/* ── Nodes ────────────────────────────────────────────────── */}
          {Object.entries(STATIC_NODES).map(([name, info]) => {
            const [x, y] = project(info.lat, info.lon);
            const nameLower = name.toLowerCase().replace(' port', '');
            const isDisrupted = disruptedNodeNames.has(nameLower);

            // Find congestion from twinState
            const liveNode = twinState?.nodes.find(
              n => n.name === name || n.city === name
            );
            const congestion = liveNode?.congestion ?? 0.3;
            const isHighCong = congestion > 0.65;
            const isPort = info.type === 'port';

            const baseColor = isDisrupted ? '#ef4444'
              : isHighCong ? '#f97316'
              : NODE_FILL[info.type];
            const r = isPort ? (isDisrupted ? 8 : 6) : (isDisrupted ? 7 : 5);

            return (
              <g key={name}
                style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
                onClick={() => onNodeClick?.(name)}
                onMouseEnter={(e) => {
                  const parentRect = (e.currentTarget.closest('.relative') as HTMLElement)?.getBoundingClientRect();
                  setTooltip({
                    text: `${isDisrupted ? '⛔ ' : ''}${name} · ${Math.round(congestion * 100)}% congestion${isDisrupted ? ' · DISRUPTED' : ''}${onNodeClick ? ' · Click to inspect' : ''}`,
                    x: e.clientX - (parentRect?.left ?? 0),
                    y: e.clientY - (parentRect?.top ?? 0),
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Pulse ring for disrupted nodes */}
                {isDisrupted && (
                  <circle cx={x} cy={y} r={r + 6} fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.4">
                    <animate attributeName="r" values={`${r + 4};${r + 12};${r + 4}`} dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Node circle */}
                <circle
                  cx={x} cy={y} r={r}
                  fill={baseColor}
                  fillOpacity={0.9}
                  stroke={isDisrupted ? '#fca5a5' : baseColor}
                  strokeWidth={isDisrupted ? 1.5 : 0.5}
                  strokeOpacity={0.8}
                />
                {/* Node label */}
                <text
                  x={x} y={y + r + 10}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize={isPort ? "9" : "8"}
                  fontWeight={isPort || isDisrupted ? "600" : "400"}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {name}
                </text>
              </g>
            );
          })}

          {/* ── Disruption label ──────────────────────────────────────── */}
          {twinState?.simulation?.active && twinState.simulation.location && (() => {
            const loc = twinState.simulation.location.replace(' Port', '');
            const nodeInfo = STATIC_NODES[loc] ?? STATIC_NODES[twinState.simulation.location];
            if (!nodeInfo) return null;
            const [x, y] = project(nodeInfo.lat, nodeInfo.lon);
            return (
              <g>
                <rect x={x - 40} y={y - 32} width={80} height={16} rx="4"
                  fill="#7f1d1d" fillOpacity="0.85" stroke="#ef4444" strokeWidth="0.8" />
                <text x={x} y={y - 21} textAnchor="middle" fill="#fca5a5" fontSize="8" fontWeight="600">
                  ⛔ {twinState.simulation.disruption_type?.replace(/_/g, ' ').toUpperCase()}
                </text>
              </g>
            );
          })()}

          {/* ── Legend ───────────────────────────────────────────────── */}
          <g transform={`translate(${W - 130}, ${svgHeight - 100})`}>
            <rect x="0" y="0" width="125" height="95" rx="6"
              fill="#0f1f3a" fillOpacity="0.9" stroke="#1e3a5f" strokeWidth="0.8" />
            {[
              { color: '#3b82f6', label: 'Normal route', dash: 'none' },
              { color: '#ef4444', label: 'Disrupted', dash: '6 4' },
              { color: '#a78bfa', label: 'Alt route', dash: '5 3' },
              { color: '#f59e0b', label: 'Degraded', dash: '3 3' },
              { color: '#60a5fa', label: 'Truck in transit', dash: 'none', dot: true },
            ].map((item, i) => (
              <g key={i} transform={`translate(8, ${14 + i * 16})`}>
                {item.dot ? (
                  <circle cx="6" cy="0" r="3" fill={item.color} opacity="0.85" />
                ) : (
                  <line x1="0" y1="0" x2="16" y2="0"
                    stroke={item.color}
                    strokeWidth="1.5"
                    strokeDasharray={item.dash === 'none' ? undefined : item.dash}
                    opacity="0.8"
                  />
                )}
                <text x="22" y="4" fill="#94a3b8" fontSize="8" fontFamily="system-ui">
                  {item.label}
                </text>
              </g>
            ))}
          </g>

          {/* ── Live stats overlay ────────────────────────────────────── */}
          {twinState && (
            <g transform="translate(8, 8)">
              <rect x="0" y="0" width="160" height="58" rx="6"
                fill="#0a1628" fillOpacity="0.9" stroke="#1e3a5f" strokeWidth="0.8" />
              <text x="8" y="16" fill="#60a5fa" fontSize="9" fontWeight="600">INDIA LOGISTICS NETWORK</text>
              <text x="8" y="30" fill="#64748b" fontSize="8">
                {twinState.stats.total_connections} routes  •  {twinState.stats.total_shipments} shipments
              </text>
              <text x="8" y="44" fill="#64748b" fontSize="8">
                {twinState.stats.delayed_shipments} delayed  •  {twinState.stats.critical_shipments} critical
              </text>
              {lastUpdated && (
                <text x="8" y="56" fill="#334155" fontSize="7">
                  Updated {lastUpdated.toLocaleTimeString()}
                </text>
              )}
            </g>
          )}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-20 bg-slate-900 border border-slate-600 text-xs text-slate-200 px-2.5 py-1.5 rounded-lg shadow-xl"
            style={{ left: tooltip.x + 12, top: tooltip.y - 10, maxWidth: 220 }}
          >
            {tooltip.text}
          </div>
        )}
    </div>
  );

  /** Status bar strip — only shown in full card mode */
  const statusBar = twinState && !compact && !headerless ? (
    <div className="px-4 py-2.5 border-t border-slate-200 flex items-center gap-6 text-xs flex-shrink-0">
      <StatusPill
        icon={<Truck className="w-3 h-3" />}
        label={`${twinState.stats.delayed_shipments} delayed shipments`}
        color={twinState.stats.delayed_shipments > 0 ? 'text-orange-600' : 'text-emerald-600'}
      />
      {twinState.stats.disrupted_connections > 0 && (
        <StatusPill
          icon={<AlertTriangle className="w-3 h-3" />}
          label={`${twinState.stats.disrupted_connections} disrupted connections`}
          color="text-red-600"
        />
      )}
      {twinState.stats.alternative_routes_active > 0 && (
        <StatusPill
          icon={<ArrowUpRight className="w-3 h-3" />}
          label={`${twinState.stats.alternative_routes_active} alt routes active`}
          color="text-purple-600"
        />
      )}
      {twinState.auto_mode.status === 'running' && (
        <StatusPill
          icon={<Zap className="w-3 h-3" />}
          label={`Auto: ${twinState.auto_mode.phase} · ${twinState.auto_mode.crises_detected} crises`}
          color="text-emerald-600"
        />
      )}
      {twinState.stats.disrupted_connections === 0 && twinState.stats.delayed_shipments === 0 && (
        <StatusPill
          icon={<CheckCircle2 className="w-3 h-3" />}
          label="All routes operational"
          color="text-emerald-600"
        />
      )}
      {twinState.simulation.active && twinState.simulation.strategy && (
        <StatusPill
          icon={<Shield className="w-3 h-3" />}
          label={`Strategy: ${twinState.simulation.strategy}`}
          color="text-blue-600"
        />
      )}
    </div>
  ) : null;

  // ── Headerless mode: just the canvas (parent supplies card + header) ──────────
  if (headerless) {
    return (
      <div className="flex flex-col h-full overflow-hidden rounded-b-xl" style={{ background: '#0a1628' }}>
        {svgCanvas}
      </div>
    );
  }

  // ── Full card mode (default) ──────────────────────────────────────────────────
  return (
    <div className="card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="card-header flex items-center justify-between py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-slate-800">Digital Twin — Live Network</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full border"
            style={{ color: healthColor, borderColor: healthColor + '55', background: healthColor + '15' }}>
            {healthLabel}
          </span>
          {twinState?.auto_mode.status === 'running' && (
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full animate-pulse font-semibold">
              AUTO MONITORING
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {twinState && (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>{twinState.stats.total_connections} routes</span>
              {twinState.stats.disrupted_connections > 0 && (
                <span className="text-red-600 font-medium">
                  {twinState.stats.disrupted_connections} disrupted
                </span>
              )}
              {twinState.stats.alternative_routes_active > 0 && (
                <span className="text-purple-600 font-medium">
                  {twinState.stats.alternative_routes_active} alt routes
                </span>
              )}
              <span>{twinState.stats.delayed_shipments} delayed</span>
            </div>
          )}
          <button
            onClick={loadState}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {svgCanvas}
      {statusBar}
    </div>
  );
}

function StatusPill({
  icon, label, color,
}: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${color}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}
