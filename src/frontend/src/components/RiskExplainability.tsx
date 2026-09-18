/**
 * RiskExplainability — Shows WHY a shipment/route/region has high risk
 *
 * Consumes simulation result risk factors and presents them in a
 * human-readable format so judges can understand the risk score.
 */

import { Shield, Thermometer, Cloud, Truck, AlertTriangle, TrendingUp, Clock, MapPin } from 'lucide-react';

interface RiskFactor {
  factor: string;
  value: number;     // 0–1 normalised weight in the risk score
  label: string;
  detail: string;
  icon: React.ReactNode;
  color: string;
}

interface RiskExplainabilityProps {
  riskScore: number;
  riskLevel: string;
  factors?: {
    delay_contribution?: number;
    cargo_value_contribution?: number;
    cold_chain_contribution?: number;
    route_risk_contribution?: number;
    priority_contribution?: number;
    fleet_avail_contribution?: number;
    // Condition-based factors (Manual Mode)
    rainfall_mm?: number;
    temperature_c?: number;
    humidity_pct?: number;
    traffic_level?: number;
    road_condition?: number;
    weather_severity?: number;
    landslide_risk?: number;
  };
  shipmentId?: string;
  delayHours?: number;
  isTemperatureSensitive?: boolean;
  priority?: number;
  compact?: boolean;
}

const RISK_LEVEL_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: '#ef4444', bg: 'bg-red-900/20',    border: 'border-red-700',    label: 'CRITICAL' },
  high:     { color: '#f97316', bg: 'bg-orange-900/20', border: 'border-orange-700', label: 'HIGH' },
  medium:   { color: '#eab308', bg: 'bg-yellow-900/20', border: 'border-yellow-700', label: 'MEDIUM' },
  low:      { color: '#22c55e', bg: 'bg-green-900/20',  border: 'border-green-700',  label: 'LOW' },
};

function getRiskFactors(props: RiskExplainabilityProps): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const f = props.factors ?? {};

  // Delay factor
  const delayContrib = f.delay_contribution ?? (props.delayHours ? Math.min(1, props.delayHours / 120) * 0.25 : 0);
  if (delayContrib > 0 || (props.delayHours ?? 0) > 0) {
    factors.push({
      factor: 'delay',
      value: delayContrib,
      label: 'Estimated Delay',
      detail: props.delayHours
        ? `${props.delayHours.toFixed(1)}h estimated delay (${(delayContrib * 100).toFixed(0)}% of risk score)`
        : `Delay contribution: ${(delayContrib * 100).toFixed(0)}%`,
      icon: <Clock className="w-3.5 h-3.5" />,
      color: delayContrib > 0.15 ? '#ef4444' : delayContrib > 0.08 ? '#f97316' : '#eab308',
    });
  }

  // Cold chain factor
  const coldContrib = f.cold_chain_contribution ?? 0;
  if (props.isTemperatureSensitive || coldContrib > 0) {
    factors.push({
      factor: 'cold_chain',
      value: coldContrib,
      label: 'Cold-Chain Risk',
      detail: props.isTemperatureSensitive
        ? `Temperature-sensitive cargo. Cold-chain exposure risk: ${(coldContrib * 100).toFixed(0)}%`
        : `Cold-chain contribution: ${(coldContrib * 100).toFixed(0)}%`,
      icon: <Thermometer className="w-3.5 h-3.5" />,
      color: coldContrib > 0.15 ? '#ef4444' : coldContrib > 0.08 ? '#f97316' : '#60a5fa',
    });
  }

  // Route risk factor
  const routeContrib = f.route_risk_contribution ?? 0;
  if (routeContrib > 0) {
    factors.push({
      factor: 'route_risk',
      value: routeContrib,
      label: 'Route Risk',
      detail: `Underlying route risk score contribution: ${(routeContrib * 100).toFixed(0)}%`,
      icon: <MapPin className="w-3.5 h-3.5" />,
      color: routeContrib > 0.1 ? '#f97316' : '#eab308',
    });
  }

  // Cargo value factor
  const cargoContrib = f.cargo_value_contribution ?? 0;
  if (cargoContrib > 0) {
    factors.push({
      factor: 'cargo_value',
      value: cargoContrib,
      label: 'Cargo Value Exposure',
      detail: `High-value cargo increases priority. Contribution: ${(cargoContrib * 100).toFixed(0)}%`,
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      color: '#8b5cf6',
    });
  }

  // Priority factor
  const priorityContrib = f.priority_contribution ?? 0;
  if (priorityContrib > 0 || (props.priority && props.priority <= 2)) {
    const pLabel = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low' }[props.priority ?? 3] ?? 'Medium';
    factors.push({
      factor: 'priority',
      value: priorityContrib,
      label: `Business Priority (${pLabel})`,
      detail: `Priority ${props.priority ?? 3} shipment. Risk weight: ${(priorityContrib * 100).toFixed(0)}%`,
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      color: (props.priority ?? 3) <= 2 ? '#ef4444' : '#f97316',
    });
  }

  // Fleet availability penalty
  const fleetContrib = f.fleet_avail_contribution ?? 0;
  if (fleetContrib > 0) {
    factors.push({
      factor: 'fleet',
      value: fleetContrib,
      label: 'Fleet Scarcity',
      detail: `Limited fleet availability increases risk. Penalty: ${(fleetContrib * 100).toFixed(0)}%`,
      icon: <Truck className="w-3.5 h-3.5" />,
      color: '#f97316',
    });
  }

  // Condition-based factors (from Manual Mode)
  if (f.rainfall_mm !== undefined && f.rainfall_mm > 20) {
    factors.push({
      factor: 'rainfall',
      value: Math.min(1, f.rainfall_mm / 100),
      label: 'Heavy Rainfall',
      detail: `${f.rainfall_mm}mm/h rainfall detected. Increases road hazard and delay risk.`,
      icon: <Cloud className="w-3.5 h-3.5" />,
      color: '#60a5fa',
    });
  }
  if (f.traffic_level !== undefined && f.traffic_level > 0.6) {
    factors.push({
      factor: 'traffic',
      value: f.traffic_level,
      label: 'High Traffic',
      detail: `Traffic level ${(f.traffic_level * 100).toFixed(0)}%. Causes cascading delays across the network.`,
      icon: <Truck className="w-3.5 h-3.5" />,
      color: '#f59e0b',
    });
  }
  if (f.weather_severity !== undefined && f.weather_severity > 0.4) {
    factors.push({
      factor: 'weather',
      value: f.weather_severity,
      label: 'Weather Severity',
      detail: `Severity ${(f.weather_severity * 100).toFixed(0)}%. Conditions may disrupt operations.`,
      icon: <Cloud className="w-3.5 h-3.5" />,
      color: '#f97316',
    });
  }
  if (f.landslide_risk !== undefined && f.landslide_risk > 0.3) {
    factors.push({
      factor: 'landslide',
      value: f.landslide_risk,
      label: 'Landslide Risk',
      detail: `Landslide probability ${(f.landslide_risk * 100).toFixed(0)}%. Route may become impassable.`,
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      color: '#dc2626',
    });
  }

  // Sort by contribution (highest first)
  return factors.sort((a, b) => b.value - a.value);
}

export default function RiskExplainability({
  riskScore,
  riskLevel,
  factors,
  shipmentId,
  delayHours,
  isTemperatureSensitive,
  priority,
  compact = false,
}: RiskExplainabilityProps) {
  const cfg = RISK_LEVEL_CONFIG[riskLevel] ?? RISK_LEVEL_CONFIG.medium;
  const riskFactors = getRiskFactors({ riskScore, riskLevel, factors, shipmentId, delayHours, isTemperatureSensitive, priority });
  const scorePct = Math.round(riskScore * 100);

  const formula = [
    { weight: '25%', name: 'Delay', color: '#ef4444' },
    { weight: '20%', name: 'Cargo Value', color: '#8b5cf6' },
    { weight: '20%', name: 'Cold-Chain', color: '#60a5fa' },
    { weight: '15%', name: 'Route Risk', color: '#f59e0b' },
    { weight: '15%', name: 'Priority', color: '#f97316' },
    { weight: '5%',  name: 'Fleet',    color: '#22c55e' },
  ];

  return (
    <div className={`space-y-3 ${compact ? '' : ''}`}>
      {/* Risk score gauge */}
      <div className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: cfg.color }} />
            <span className="text-sm font-semibold text-slate-200">
              {shipmentId ? `Shipment ${shipmentId.slice(-8)} Risk` : 'Risk Assessment'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: cfg.color }}>{scorePct}</span>
            <span className="text-xs text-slate-500">/ 100</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${cfg.border}`} style={{ color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
        </div>
        {/* Score bar */}
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${scorePct}%`, background: cfg.color }}
          />
        </div>
      </div>

      {/* Risk factors */}
      {riskFactors.length > 0 && (
        <div className={`${compact ? 'space-y-1.5' : 'space-y-2'}`}>
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide px-1">
            Contributing Factors
          </div>
          {riskFactors.map(factor => (
            <div key={factor.factor}
              className="flex items-start gap-3 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5">
              <div className="mt-0.5" style={{ color: factor.color }}>
                {factor.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-200">{factor.label}</span>
                  <span className="text-xs font-bold ml-2" style={{ color: factor.color }}>
                    {factor.value > 0 ? `+${(factor.value * 100).toFixed(0)}` : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{factor.detail}</p>
                {/* Mini bar */}
                {factor.value > 0 && (
                  <div className="mt-1.5 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, factor.value * 300)}%`, background: factor.color, opacity: 0.7 }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formula breakdown */}
      {!compact && (
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-2">Risk Score Formula Weights</div>
          <div className="flex flex-wrap gap-2">
            {formula.map(f => (
              <div key={f.name} className="flex items-center gap-1 text-xs">
                <div className="w-2 h-2 rounded-sm" style={{ background: f.color }} />
                <span className="text-slate-400">{f.weight} {f.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
