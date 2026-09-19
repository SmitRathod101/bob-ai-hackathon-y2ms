import { ThermometerSnowflake, AlertTriangle, Thermometer } from 'lucide-react';
import { formatCurrency, formatDelay } from '../utils/format';

interface ColdChainShipment {
  shipment_id: string;
  cargo_value: number;
  cold_chain_risk: number;
  risk_level: string;
  delay_hours: number;
  is_direct: boolean;
}

interface ColdChainPanelProps {
  shipments: ColdChainShipment[];
  totalAtRisk: number;
}

export default function ColdChainPanel({ shipments, totalAtRisk }: ColdChainPanelProps) {
  const coldChainShipments = shipments.filter(s => s.cold_chain_risk > 0.1);
  if (!coldChainShipments.length) {
    return (
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <ThermometerSnowflake className="w-4 h-4 text-cyan-500" />
          <h3 className="text-sm font-semibold text-gray-800">Cold-Chain Impact</h3>
        </div>
        <div className="card-body text-center text-gray-400 text-sm py-8">
          No cold-chain shipments affected in this scenario.
        </div>
      </div>
    );
  }

  const critical = coldChainShipments.filter(s => s.cold_chain_risk > 0.7).length;
  const high = coldChainShipments.filter(s => s.cold_chain_risk > 0.5 && s.cold_chain_risk <= 0.7).length;
  const medium = coldChainShipments.filter(s => s.cold_chain_risk > 0.3 && s.cold_chain_risk <= 0.5).length;
  const totalExposedValue = coldChainShipments.reduce((s, sh) => s + sh.cargo_value, 0);

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ThermometerSnowflake className="w-4 h-4 text-cyan-500" />
          <h3 className="text-sm font-semibold text-gray-800">Cold-Chain Risk</h3>
          <span className="badge badge-high text-xs">{totalAtRisk} at risk</span>
        </div>
        <span className="text-xs text-gray-400">Exposed: {formatCurrency(totalExposedValue)}</span>
      </div>
      <div className="card-body space-y-4">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-red-600">{critical}</p>
            <p className="text-xs text-gray-500 mt-0.5">Critical (&gt;70%)</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-orange-600">{high}</p>
            <p className="text-xs text-gray-500 mt-0.5">High (50–70%)</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-amber-600">{medium}</p>
            <p className="text-xs text-gray-500 mt-0.5">Medium (30–50%)</p>
          </div>
        </div>

        {/* Risk bar visualization */}
        <div className="space-y-2">
          <p className="text-xs text-gray-600 font-medium">Top cold-chain shipments by risk:</p>
          {coldChainShipments
            .sort((a, b) => b.cold_chain_risk - a.cold_chain_risk)
            .slice(0, 8)
            .map(s => (
              <div key={s.shipment_id} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-20 flex-shrink-0">
                  <Thermometer className="w-3 h-3 text-cyan-500 flex-shrink-0" />
                  <span className="text-xs font-mono text-gray-600 truncate">{s.shipment_id}</span>
                </div>
                <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      s.cold_chain_risk > 0.7 ? 'bg-red-500' :
                      s.cold_chain_risk > 0.5 ? 'bg-orange-500' :
                      s.cold_chain_risk > 0.3 ? 'bg-amber-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${s.cold_chain_risk * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-medium w-10 text-right flex-shrink-0 ${
                  s.cold_chain_risk > 0.7 ? 'text-red-600' :
                  s.cold_chain_risk > 0.5 ? 'text-orange-600' :
                  s.cold_chain_risk > 0.3 ? 'text-amber-600' : 'text-cyan-600'
                }`}>
                  {(s.cold_chain_risk * 100).toFixed(0)}%
                </span>
                <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">
                  {formatDelay(s.delay_hours)}
                </span>
              </div>
            ))}
        </div>

        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-xs text-cyan-700">
          <AlertTriangle className="w-3 h-3 inline mr-1.5" />
          Temperature-sensitive cargo (vaccines, pharmaceuticals, produce) requires refrigerated vehicles for recovery.
          Deploy cold-chain fleet immediately for Critical-risk shipments.
        </div>
      </div>
    </div>
  );
}
