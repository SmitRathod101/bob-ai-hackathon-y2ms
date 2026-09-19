/**
 * ShipmentDetailPanel — Detail view for a selected shipment
 * Uses real Shipment data from the API. No mock data.
 */

import { useState } from 'react';
import type { Shipment } from '../services/api';
import { formatCurrency, formatDelay } from '../utils/format';
import {
  Package, MapPin, Thermometer, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, ArrowRight,
  Truck, Star,
} from 'lucide-react';

interface ShipmentDetailPanelProps {
  shipment: Shipment;
  relatedSimulationId?: string;
  onNavigate: (section: string) => void;
  onClose: () => void;
}

export default function ShipmentDetailPanel({
  shipment,
  onNavigate,
  onClose,
}: ShipmentDetailPanelProps) {
  const [showActions, setShowActions] = useState(false);

  const riskLevel =
    shipment.risk_score >= 0.7 ? 'critical' :
    shipment.risk_score >= 0.45 ? 'high' :
    shipment.risk_score >= 0.2 ? 'medium' : 'low';

  const riskCfg = {
    critical: { cls: 'bg-red-50 text-red-700 border-red-200',    dot: 'bg-red-500' },
    high:     { cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
    medium:   { cls: 'bg-amber-50 text-amber-700 border-amber-200',  dot: 'bg-amber-500' },
    low:      { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  }[riskLevel];

  const statusCfg: Record<string, string> = {
    in_transit:  'bg-blue-50 text-blue-700 border-blue-200',
    delayed:     'bg-amber-50 text-amber-700 border-amber-200',
    at_port:     'bg-violet-50 text-violet-700 border-violet-200',
    at_warehouse:'bg-cyan-50 text-cyan-700 border-cyan-200',
    delivered:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const progressPct = Math.max(0, Math.min(100, shipment.progress_pct));
  const isDelayed = shipment.estimated_delay_hours > 0 || shipment.status === 'delayed';
  const isColdChain = shipment.temperature_sensitive;

  return (
    <div className="space-y-0">
      {/* ── Status strip ─────────────────────────────────────────────── */}
      <div className={`px-5 py-3 flex items-center gap-3 border-b ${
        isDelayed ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'
      }`}>
        {isDelayed
          ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          : <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        }
        <span className={`text-sm font-medium ${isDelayed ? 'text-amber-800' : 'text-emerald-800'}`}>
          {isDelayed
            ? `Delayed — ${formatDelay(shipment.estimated_delay_hours)} behind schedule`
            : 'On schedule'
          }
        </span>
        {isColdChain && (
          <span className="ml-auto flex items-center gap-1 text-xs text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-full">
            <Thermometer className="w-3 h-3" />
            Cold Chain
          </span>
        )}
      </div>

      {/* ── Core fields ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-4">

        {/* ID + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono">
            {shipment.shipment_id}
          </code>
          <span className={`text-xs font-semibold border rounded px-2 py-0.5 capitalize ${statusCfg[shipment.status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            {shipment.status.replace(/_/g, ' ')}
          </span>
          <span className={`text-xs font-semibold border rounded px-2 py-0.5 capitalize flex items-center gap-1 ${riskCfg.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${riskCfg.dot}`} />
            {riskLevel} risk
          </span>
          {shipment.priority >= 3 && (
            <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              <Star className="w-3 h-3" />
              Priority {shipment.priority}
            </span>
          )}
        </div>

        {/* Route */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Route</div>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-1">
                <MapPin className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-sm font-semibold text-slate-800">{shipment.origin}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Origin</div>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1">
              <ArrowRight className="w-4 h-4 text-slate-300" />
              {/* Progress bar */}
              <div className="w-full">
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isDelayed ? 'bg-amber-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="text-[10px] text-center text-slate-400 mt-0.5">{progressPct}% complete</div>
              </div>
            </div>
            <div className="flex-1 text-center">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-1">
                <MapPin className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-sm font-semibold text-slate-800">{shipment.destination}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">Destination</div>
            </div>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          <MetricRow
            icon={<Package className="w-3.5 h-3.5 text-slate-400" />}
            label="Cargo Type"
            value={shipment.cargo_type ?? '—'}
          />
          <MetricRow
            icon={<TrendingUp className="w-3.5 h-3.5 text-slate-400" />}
            label="Cargo Value"
            value={shipment.cargo_value ? formatCurrency(shipment.cargo_value) : '—'}
          />
          <MetricRow
            icon={<Clock className="w-3.5 h-3.5 text-amber-500" />}
            label="Est. Delay"
            value={shipment.estimated_delay_hours > 0 ? formatDelay(shipment.estimated_delay_hours) : 'On time'}
            valueClass={shipment.estimated_delay_hours > 0 ? 'text-amber-700 font-semibold' : 'text-emerald-700'}
          />
          {shipment.weight_kg && (
            <MetricRow
              icon={<Truck className="w-3.5 h-3.5 text-slate-400" />}
              label="Weight"
              value={`${shipment.weight_kg.toLocaleString()} kg`}
            />
          )}
          {shipment.carrier && (
            <MetricRow
              icon={<Truck className="w-3.5 h-3.5 text-slate-400" />}
              label="Carrier"
              value={shipment.carrier}
            />
          )}
          <MetricRow
            icon={<TrendingUp className="w-3.5 h-3.5 text-slate-400" />}
            label="Risk Score"
            value={`${Math.round(shipment.risk_score * 100)}%`}
            valueClass={riskLevel === 'critical' || riskLevel === 'high' ? 'text-red-700 font-semibold' : ''}
          />
        </div>

        {/* Cold chain details */}
        {isColdChain && (
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-cyan-600" />
              <span className="text-sm font-semibold text-cyan-800">Cold Chain Requirements</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {shipment.required_temp_min != null && (
                <div>
                  <div className="text-cyan-600 font-medium">Min Temp</div>
                  <div className="text-cyan-900">{shipment.required_temp_min}°C</div>
                </div>
              )}
              {shipment.required_temp_max != null && (
                <div>
                  <div className="text-cyan-600 font-medium">Max Temp</div>
                  <div className="text-cyan-900">{shipment.required_temp_max}°C</div>
                </div>
              )}
              {shipment.current_temperature != null && (
                <div className="col-span-2">
                  <div className="text-cyan-600 font-medium">Current Temp</div>
                  <div className={`font-semibold ${
                    shipment.required_temp_max != null && shipment.current_temperature > shipment.required_temp_max
                      ? 'text-red-700'
                      : 'text-cyan-900'
                  }`}>
                    {shipment.current_temperature}°C
                    {shipment.required_temp_max != null && shipment.current_temperature > shipment.required_temp_max && (
                      <span className="text-red-600 ml-1">⚠ Exceeds limit</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action section */}
        <div className="border-t border-slate-100 pt-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Actions</div>
          {!showActions ? (
            <div className="space-y-2">
              <button
                onClick={() => { onNavigate('network'); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors text-left"
              >
                <ArrowRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <div>
                  <div className="font-medium">View Route Network</div>
                  <div className="text-xs text-slate-400">See the {shipment.origin} → {shipment.destination} corridor</div>
                </div>
              </button>
              {(riskLevel === 'critical' || riskLevel === 'high') && (
                <button
                  onClick={() => setShowActions(true)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 hover:bg-amber-100 transition-colors text-left"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <div>
                    <div className="font-medium">Analyze Impact</div>
                    <div className="text-xs text-amber-600">Run crisis simulation for this corridor</div>
                  </div>
                </button>
              )}
              <button
                onClick={() => { onNavigate('crisis-simulator'); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <TrendingUp className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <div>
                  <div className="font-medium">Crisis Simulator</div>
                  <div className="text-xs text-slate-400">Simulate disruptions affecting this shipment</div>
                </div>
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
              <p className="text-amber-800 font-medium mb-2">Run Impact Analysis</p>
              <p className="text-amber-700 text-xs mb-3">
                To analyze this shipment's disruption impact, use the Crisis Simulator with{' '}
                <strong>{shipment.origin}</strong> as the affected location.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onNavigate('crisis-simulator'); onClose(); }}
                  className="flex-1 btn-primary text-xs py-2"
                >
                  Open Crisis Simulator
                </button>
                <button
                  onClick={() => setShowActions(false)}
                  className="px-3 py-2 rounded-lg border border-amber-300 text-amber-700 text-xs hover:bg-amber-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  icon,
  label,
  value,
  valueClass = '',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className={`text-sm text-slate-800 ${valueClass}`}>{value}</div>
    </div>
  );
}
