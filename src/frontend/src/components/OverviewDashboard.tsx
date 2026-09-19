/**
 * OverviewDashboard — AI-powered Supply Chain Control Center
 * Enterprise operations control center: MONITOR → INVESTIGATE → ANALYZE → DECIDE → ACT
 */

import { useState, useCallback } from 'react';
import type { DashboardSummary, SimulationSummary, Port, Shipment } from '../services/api';
import { formatCurrency } from '../utils/format';
import DigitalTwin from './DigitalTwin';
import DetailDrawer from './DetailDrawer';
import ShipmentDetailPanel from './ShipmentDetailPanel';
import RouteDetailPanel from './RouteDetailPanel';
import DisruptionDetailPanel from './DisruptionDetailPanel';
import AIAnalysisPanel from './AIAnalysisPanel';
import {
  Package, Truck, AlertTriangle,
  Ship, CheckCircle2, Activity, TrendingUp, TrendingDown,
  ArrowRight, Clock, Zap, BrainCircuit, ChevronRight,
  MapPin,
} from 'lucide-react';

// ── Drawer content types ──────────────────────────────────────────────────────

type DrawerContent =
  | { type: 'shipment'; shipment: Shipment }
  | { type: 'route'; nodeName: string }
  | { type: 'disruption'; simulation: SimulationSummary }
  | { type: 'ai'; simulation: SimulationSummary };

interface OverviewDashboardProps {
  data: DashboardSummary | null;
  loading: boolean;
  onNavigate: (s: string) => void;
}

export default function OverviewDashboard({ data, loading, onNavigate }: OverviewDashboardProps) {
  const [drawer, setDrawer] = useState<DrawerContent | null>(null);

  const closeDrawer = useCallback(() => setDrawer(null), []);

  const openNode = useCallback((nodeName: string) => {
    setDrawer({ type: 'route', nodeName });
  }, []);

  const openDisruption = useCallback((sim: SimulationSummary) => {
    setDrawer({ type: 'disruption', simulation: sim });
  }, []);

  const openAI = useCallback((sim: SimulationSummary) => {
    setDrawer({ type: 'ai', simulation: sim });
  }, []);

  // ── Drawer config ─────────────────────────────────────────────────────────

  const drawerConfig = (() => {
    if (!drawer) return { title: '', subtitle: undefined, width: 'md' as const };
    if (drawer.type === 'shipment') return {
      title: `Shipment ${drawer.shipment.shipment_id.slice(-8)}`,
      subtitle: `${drawer.shipment.origin} → ${drawer.shipment.destination}`,
      width: 'md' as const,
    };
    if (drawer.type === 'route') return {
      title: `Network Node — ${drawer.nodeName}`,
      subtitle: 'Routes and connections through this node',
      width: 'md' as const,
    };
    if (drawer.type === 'disruption') return {
      title: 'Disruption Details',
      subtitle: `${drawer.simulation.location} · ${drawer.simulation.disruption_type?.replace(/_/g, ' ')}`,
      width: 'lg' as const,
    };
    if (drawer.type === 'ai') return {
      title: 'ChainMind AI Analysis',
      subtitle: `${drawer.simulation.location} · ${drawer.simulation.disruption_type?.replace(/_/g, ' ')}`,
      width: 'lg' as const,
    };
    return { title: '', subtitle: undefined, width: 'md' as const };
  })();

  // ── Render loading / no-data ──────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading supply chain data…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        No data available. Check backend connection.
      </div>
    );
  }

  const fleet = data.fleet_summary;
  const recentCrises = data.recent_simulations.filter(
    s => s.total_affected_shipments > 0 && s.status === 'completed'
  );
  const totalDelayed = data.delayed;
  const onTimeRate = data.total_shipments > 0
    ? Math.round(((data.total_shipments - totalDelayed) / data.total_shipments) * 100)
    : 100;

  // Risk items derived from real data
  const riskItems: Array<{
    id: string;
    label: string;
    detail: string;
    level: 'critical' | 'warning' | 'info';
    action?: () => void;
    actionLabel?: string;
  }> = [];

  if (totalDelayed > 0) {
    riskItems.push({
      id: 'delayed',
      label: `${totalDelayed} shipments delayed`,
      detail: `${100 - onTimeRate}% of network affected`,
      level: totalDelayed > 10 ? 'critical' : 'warning',
      action: () => onNavigate('shipments'),
      actionLabel: 'View Shipments',
    });
  }

  data.ports.filter(p => p.operational_status !== 'operational').forEach(p => {
    riskItems.push({
      id: `dis-${p.port_id}`,
      label: `${p.name} disrupted`,
      detail: `Status: ${p.operational_status}`,
      level: 'critical',
      action: () => openNode(p.name),
      actionLabel: 'Inspect',
    });
  });

  data.ports.filter(p => p.congestion > 0.65 && p.operational_status === 'operational').forEach(p => {
    riskItems.push({
      id: `cong-${p.port_id}`,
      label: `${p.name} congestion`,
      detail: `${Math.round(p.congestion * 100)}% congested`,
      level: 'warning',
      action: () => openNode(p.name),
      actionLabel: 'Inspect',
    });
  });

  if (data.cold_chain_shipments > 0) {
    riskItems.push({
      id: 'cold-chain',
      label: `${data.cold_chain_shipments} cold-chain active`,
      detail: 'Temperature-sensitive cargo in transit',
      level: 'info',
      action: () => onNavigate('shipments'),
      actionLabel: 'View',
    });
  }

  return (
    <>
      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      <DetailDrawer
        open={!!drawer}
        onClose={closeDrawer}
        title={drawerConfig.title}
        subtitle={drawerConfig.subtitle}
        width={drawerConfig.width}
      >
        {drawer?.type === 'shipment' && (
          <ShipmentDetailPanel
            shipment={drawer.shipment}
            onNavigate={onNavigate}
            onClose={closeDrawer}
          />
        )}
        {drawer?.type === 'route' && (
          <RouteDetailPanel
            nodeName={drawer.nodeName}
            onNavigate={onNavigate}
            onClose={closeDrawer}
          />
        )}
        {drawer?.type === 'disruption' && (
          <DisruptionDetailPanel
            simulation={drawer.simulation}
            onNavigate={onNavigate}
            onClose={closeDrawer}
          />
        )}
        {drawer?.type === 'ai' && (
          <AIAnalysisPanel
            simulation={drawer.simulation}
            onNavigate={onNavigate}
            onClose={closeDrawer}
          />
        )}
      </DetailDrawer>

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 h-full">

        {/* ── KPI Row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Active Shipments"
            value={data.in_transit}
            sub={`of ${data.total_shipments} total`}
            icon={<Package className="w-4 h-4" />}
            accent="blue"
            trend={data.in_transit > 0 ? 'up' : 'neutral'}
            onClick={() => onNavigate('shipments')}
          />
          <KpiCard
            label="At Risk / Delayed"
            value={totalDelayed}
            sub={`${100 - onTimeRate}% affected`}
            icon={<AlertTriangle className="w-4 h-4" />}
            accent={totalDelayed > 10 ? 'red' : totalDelayed > 0 ? 'amber' : 'green'}
            trend={totalDelayed > 0 ? 'down' : 'neutral'}
            alert={totalDelayed > 10}
            onClick={() => onNavigate('shipments')}
          />
          <KpiCard
            label="Active Routes"
            value={data.ports.filter(p => p.operational_status === 'operational').length}
            sub={`${data.ports.length} ports tracked`}
            icon={<Activity className="w-4 h-4" />}
            accent="green"
            trend="neutral"
            onClick={() => onNavigate('network')}
          />
          <KpiCard
            label="Disruptions"
            value={recentCrises.length}
            sub="recent simulations"
            icon={<Zap className="w-4 h-4" />}
            accent={recentCrises.length > 0 ? 'amber' : 'green'}
            trend="neutral"
            onClick={() => onNavigate('disruptions')}
          />
          <KpiCard
            label="Cargo Exposure"
            value={formatCurrency(data.total_cargo_value)}
            sub="total active network"
            icon={<Ship className="w-4 h-4" />}
            accent="purple"
            trend="neutral"
          />
          <KpiCard
            label="Fleet Available"
            value={`${fleet.available_vehicles}/${fleet.total_vehicles}`}
            sub={`${fleet.utilization_pct}% utilized`}
            icon={<Truck className="w-4 h-4" />}
            accent={fleet.utilization_pct > 90 ? 'amber' : 'green'}
            trend="neutral"
          />
        </div>

        {/* ── Main: Digital Twin + right panels ───────────────────────────── */}
        <div className="flex gap-4 min-h-[560px]" style={{ flex: '1 1 560px' }}>

          {/* Map — primary visual: DigitalTwin renders its own card+header */}
          <div className="flex-1 min-w-0 flex flex-col">
            <DigitalTwin
              compact={false}
              headerless={false}
              onNodeClick={openNode}
            />
          </div>

          {/* Right panel stack */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-3">

            {/* Active Risks — scrollable when tall */}
            <div className="card flex flex-col min-h-0">
              <div className="card-header py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Active Risks</h3>
                  {riskItems.filter(r => r.level === 'critical').length > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full font-semibold">
                      {riskItems.filter(r => r.level === 'critical').length} critical
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onNavigate('disruptions')}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5 font-medium"
                >
                  All <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="card-body p-2 space-y-1.5 overflow-y-auto" style={{ maxHeight: 240 }}>
                {riskItems.length > 0 ? (
                  riskItems.map(item => (
                    <InteractiveRiskItem
                      key={item.id}
                      label={item.label}
                      detail={item.detail}
                      level={item.level}
                      action={item.action}
                      actionLabel={item.actionLabel}
                    />
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-emerald-700 text-xs py-2 px-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    All systems nominal
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity / Simulations */}
            <div className="card flex flex-col" style={{ flex: '1 1 0', minHeight: 0 }}>
              <div className="card-header py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Recent Activity</h3>
                </div>
                <button
                  onClick={() => onNavigate('history')}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5 font-medium"
                >
                  History <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {data.recent_simulations.length === 0 ? (
                  <div className="p-4 text-xs text-slate-400 text-center">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    No recent simulations.{' '}
                    <button
                      onClick={() => onNavigate('crisis-simulator')}
                      className="text-blue-500 hover:text-blue-600 underline"
                    >
                      Run one now
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.recent_simulations.slice(0, 6).map(sim => (
                      <SimulationActivityItem
                        key={sim.simulation_id}
                        sim={sim}
                        onOpenDisruption={() => openDisruption(sim)}
                        onOpenAI={() => openAI(sim)}
                      />
                    ))}
                  </div>
                )}
              </div>
              {data.recent_simulations.length > 0 && (
                <div className="px-3 py-2 border-t border-slate-100">
                  <button
                    onClick={() => onNavigate('crisis-simulator')}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium py-1"
                  >
                    <Zap className="w-3 h-3" />
                    Run New Simulation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom row: Shipment status + Port network ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* Shipment status breakdown */}
          <div className="card">
            <div className="card-header flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-800">Shipment Status</h3>
              </div>
              <button
                onClick={() => onNavigate('shipments')}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5 font-medium"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="card-body py-3 space-y-2.5">
              {[
                { label: 'In Transit',   count: data.in_transit,   color: 'bg-blue-500',    cls: 'text-blue-700' },
                { label: 'At Port',      count: data.at_port,      color: 'bg-violet-500',  cls: 'text-violet-700' },
                { label: 'Delayed',      count: data.delayed,      color: 'bg-amber-500',   cls: 'text-amber-700' },
                { label: 'At Warehouse', count: data.at_warehouse, color: 'bg-cyan-500',    cls: 'text-cyan-700' },
                { label: 'Delivered',    count: data.delivered,    color: 'bg-emerald-500', cls: 'text-emerald-700' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => onNavigate('shipments')}
                  className="w-full flex items-center gap-3 hover:bg-slate-50 rounded-lg px-1 py-0.5 transition-colors text-left"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs text-slate-500">{item.label}</span>
                      <span className={`text-xs font-semibold ${item.cls}`}>{item.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-500`}
                        style={{ width: `${data.total_shipments > 0 ? (item.count / data.total_shipments) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Port network status — clickable */}
          <div className="card">
            <div className="card-header flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <Ship className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-800">Port Network</h3>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Click to inspect</span>
              </div>
              <button
                onClick={() => onNavigate('network')}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5 font-medium"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="card-body py-3">
              <div className="grid grid-cols-2 gap-2">
                {data.ports.slice(0, 8).map(port => (
                  <ClickablePortCard
                    key={port.port_id}
                    port={port}
                    onClick={() => openNode(port.name)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, accent, trend, alert, onClick,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  accent: 'blue' | 'green' | 'red' | 'amber' | 'purple';
  trend: 'up' | 'down' | 'neutral';
  alert?: boolean;
  onClick?: () => void;
}) {
  const accentMap = {
    blue:   { border: 'border-blue-200',   bg: 'bg-blue-50',   icon: 'text-blue-600',   value: 'text-blue-800' },
    green:  { border: 'border-emerald-200',bg: 'bg-emerald-50',icon: 'text-emerald-600',value: 'text-emerald-800' },
    red:    { border: 'border-red-200',    bg: 'bg-red-50',    icon: 'text-red-600',    value: 'text-red-800' },
    amber:  { border: 'border-amber-200',  bg: 'bg-amber-50',  icon: 'text-amber-600',  value: 'text-amber-800' },
    purple: { border: 'border-violet-200', bg: 'bg-violet-50', icon: 'text-violet-600', value: 'text-violet-800' },
  }[accent];

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-4 flex flex-col gap-1.5 shadow-sm transition-all duration-150 ${accentMap.border} ${accentMap.bg} ${alert ? 'ring-2 ring-red-300' : ''} ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.01]' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <span className={accentMap.icon}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold leading-none ${accentMap.value}`}>{value}</div>
      <div className="flex items-center gap-1.5">
        {trend === 'up'   && <TrendingUp className="w-3 h-3 text-emerald-600" />}
        {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
        <span className="text-[11px] text-slate-400">{sub}</span>
      </div>
    </div>
  );
}

function InteractiveRiskItem({
  label, detail, level, action, actionLabel,
}: {
  label: string;
  detail: string;
  level: 'critical' | 'warning' | 'info';
  action?: () => void;
  actionLabel?: string;
}) {
  const cfg = {
    critical: { border: 'border-red-200',   bg: 'bg-red-50',   label: 'text-red-800',   detail: 'text-red-600',  dot: 'bg-red-500',   action: 'text-red-700 hover:text-red-900' },
    warning:  { border: 'border-amber-200', bg: 'bg-amber-50', label: 'text-amber-800', detail: 'text-amber-600',dot: 'bg-amber-500', action: 'text-amber-700 hover:text-amber-900' },
    info:     { border: 'border-blue-200',  bg: 'bg-blue-50',  label: 'text-blue-800',  detail: 'text-blue-600', dot: 'bg-blue-500',  action: 'text-blue-700 hover:text-blue-900' },
  }[level];

  return (
    <div className={`rounded-lg border p-2.5 ${cfg.border} ${cfg.bg} transition-colors ${action ? 'cursor-pointer hover:opacity-90' : ''}`}
      onClick={action}>
      <div className="flex items-start gap-2">
        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-semibold leading-tight ${cfg.label}`}>{label}</div>
          <div className={`text-[11px] mt-0.5 ${cfg.detail}`}>{detail}</div>
        </div>
        {action && actionLabel && (
          <span className={`text-[10px] font-semibold flex-shrink-0 flex items-center gap-0.5 ${cfg.action}`}>
            {actionLabel} <ChevronRight className="w-2.5 h-2.5" />
          </span>
        )}
      </div>
    </div>
  );
}

function SimulationActivityItem({
  sim, onOpenDisruption, onOpenAI,
}: {
  sim: SimulationSummary;
  onOpenDisruption: () => void;
  onOpenAI: () => void;
}) {
  const sevCls = {
    high:   'bg-red-50 text-red-700 border-red-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low:    'bg-green-50 text-green-700 border-green-200',
  }[sim.severity] ?? 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <div className="px-3 py-2.5 hover:bg-slate-50 transition-colors group">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-800 font-medium leading-snug truncate">
            {sim.scenario_name || sim.location}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
            <MapPin className="w-2.5 h-2.5" />
            <span className="truncate">{sim.location}</span>
            <span>·</span>
            <span>{sim.total_affected_shipments} affected</span>
          </div>
        </div>
        <span className={`text-[10px] font-semibold border rounded px-1.5 py-0.5 capitalize flex-shrink-0 ${sevCls}`}>
          {sim.severity}
        </span>
      </div>

      {/* Action buttons — appear on hover / always visible on mobile */}
      <div className="flex gap-1.5 mt-1.5">
        <button
          onClick={onOpenDisruption}
          className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors"
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          Details
        </button>
        {sim.recommended_strategy && (
          <button
            onClick={onOpenAI}
            className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition-colors"
          >
            <BrainCircuit className="w-2.5 h-2.5" />
            AI Analysis
          </button>
        )}
      </div>
    </div>
  );
}

function ClickablePortCard({ port, onClick }: { port: Port; onClick: () => void }) {
  const congPct = Math.round(port.congestion * 100);
  const isHigh = port.congestion > 0.65;
  const isDisrupted = port.operational_status !== 'operational';

  return (
    <button
      onClick={onClick}
      className={`rounded-lg p-2 border text-xs transition-all text-left w-full hover:shadow-sm active:scale-95 ${
        isDisrupted ? 'border-red-200 bg-red-50 hover:bg-red-100' :
        isHigh      ? 'border-amber-200 bg-amber-50 hover:bg-amber-100' :
                      'border-slate-100 bg-slate-50 hover:bg-slate-100'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-700 font-medium truncate">{port.name}</span>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ml-1 ${
          isDisrupted ? 'bg-red-500 animate-pulse' :
          isHigh      ? 'bg-amber-500' :
                        'bg-emerald-500'
        }`} />
      </div>
      <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isHigh ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${congPct}%` }}
        />
      </div>
      <div className="flex justify-between items-center mt-0.5">
        <span className={`text-[10px] ${isHigh ? 'text-amber-600' : 'text-slate-400'}`}>
          {congPct}% congestion
        </span>
        <ChevronRight className="w-2.5 h-2.5 text-slate-300" />
      </div>
    </button>
  );
}
