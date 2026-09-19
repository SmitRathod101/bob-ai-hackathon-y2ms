/**
 * DisruptionDetailPanel — Detail view for a selected disruption/simulation
 * Fetches full simulation result from /api/simulations/{id}
 * Shows real impact data + AI recommendations + action flow.
 */

import { useState, useEffect } from 'react';
import type { SimulationResult, SimulationSummary } from '../services/api';
import { getSimulation, runSimulation } from '../services/api';
import { formatCurrency, formatDelay, disruption_label } from '../utils/format';
import {
  AlertTriangle, Loader2, Zap, BrainCircuit,
  Package, ArrowRight, TrendingUp, CheckCircle2,
  RefreshCw, Ship, Clock,
} from 'lucide-react';

interface DisruptionDetailPanelProps {
  simulation: SimulationSummary;
  onNavigate: (section: string) => void;
  onClose: () => void;
}

export default function DisruptionDetailPanel({
  simulation,
  onNavigate,
  onClose,
}: DisruptionDetailPanelProps) {
  const [detail, setDetail] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-simulation (analyze impact)
  const [reRunning, setReRunning] = useState(false);
  const [reRunResult, setReRunResult] = useState<SimulationResult | null>(null);
  const [reRunError, setReRunError] = useState<string | null>(null);
  const [showReRunConfirm, setShowReRunConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSimulation(simulation.simulation_id)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(e => { if (!cancelled) setError(e.message ?? 'Failed to load details'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [simulation.simulation_id]);

  const handleReRun = async () => {
    setReRunning(true);
    setReRunError(null);
    setShowReRunConfirm(false);
    try {
      const res = await runSimulation({
        disruption_type: simulation.disruption_type,
        location: simulation.location,
        duration_hours: simulation.duration_hours,
        severity: simulation.severity,
        capacity_reduction: 1.0,
      });
      setReRunResult(res);
    } catch (e: unknown) {
      setReRunError(e instanceof Error ? e.message : 'Re-simulation failed');
    } finally {
      setReRunning(false);
    }
  };

  const displayResult = reRunResult ?? detail;
  const sevCls = {
    high:   'bg-red-50 text-red-700 border-red-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low:    'bg-green-50 text-green-700 border-green-200',
  }[simulation.severity] ?? 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <div className="space-y-0">
      {/* Status strip */}
      <div className={`px-5 py-3 flex items-center gap-3 border-b ${
        simulation.severity === 'high' ? 'bg-red-50 border-red-100' :
        simulation.severity === 'medium' ? 'bg-amber-50 border-amber-100' :
        'bg-green-50 border-green-100'
      }`}>
        <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${
          simulation.severity === 'high' ? 'text-red-500' :
          simulation.severity === 'medium' ? 'text-amber-500' : 'text-green-500'
        }`} />
        <span className={`text-sm font-medium ${
          simulation.severity === 'high' ? 'text-red-800' :
          simulation.severity === 'medium' ? 'text-amber-800' : 'text-green-800'
        }`}>
          {disruption_label(simulation.disruption_type)} at {simulation.location}
        </span>
        <span className={`ml-auto text-[10px] font-semibold border rounded px-2 py-0.5 capitalize ${sevCls}`}>
          {simulation.severity} severity
        </span>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Quick summary */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            icon={<Package className="w-4 h-4 text-orange-500" />}
            label="Affected Shipments"
            value={simulation.total_affected_shipments}
            valueClass={simulation.total_affected_shipments > 20 ? 'text-red-700 font-bold' : 'text-slate-900 font-semibold'}
          />
          <SummaryCard
            icon={<TrendingUp className="w-4 h-4 text-amber-500" />}
            label="Avg Delay"
            value={formatDelay(simulation.average_delay_hours)}
            valueClass={simulation.average_delay_hours > 48 ? 'text-red-700 font-bold' : 'text-slate-900 font-semibold'}
          />
          <SummaryCard
            icon={<Ship className="w-4 h-4 text-blue-500" />}
            label="Cargo Exposed"
            value={formatCurrency(simulation.total_cargo_value_exposed)}
            valueClass="text-slate-900 font-semibold"
          />
          <SummaryCard
            icon={<Clock className="w-4 h-4 text-slate-400" />}
            label="Duration"
            value={`${simulation.duration_hours}h`}
            valueClass="text-slate-900 font-semibold"
          />
        </div>

        {/* Recommended strategy */}
        {simulation.recommended_strategy && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <BrainCircuit className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">AI Recommended Strategy</span>
            </div>
            <p className="text-sm text-blue-700 capitalize">
              {simulation.recommended_strategy.replace(/_/g, ' ')}
            </p>
          </div>
        )}

        {/* Detailed result (lazy loaded) */}
        {loading && (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading full analysis…
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            {error}
            <button
              onClick={() => window.location.reload()}
              className="block mt-2 text-xs underline"
            >
              Refresh
            </button>
          </div>
        )}

        {displayResult && !loading && (
          <div className="space-y-4">
            {/* Impact breakdown */}
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Impact Breakdown</div>
              <div className="space-y-2">
                <ImpactRow
                  label="Directly affected"
                  value={displayResult.impact_summary.directly_affected}
                  total={displayResult.impact_summary.total_affected_shipments}
                  color="bg-red-500"
                />
                <ImpactRow
                  label="Cascade impact"
                  value={displayResult.impact_summary.indirectly_affected}
                  total={displayResult.impact_summary.total_affected_shipments}
                  color="bg-orange-400"
                />
                {displayResult.impact_summary.cold_chain_at_risk > 0 && (
                  <ImpactRow
                    label="Cold chain at risk"
                    value={displayResult.impact_summary.cold_chain_at_risk}
                    total={displayResult.impact_summary.total_affected_shipments}
                    color="bg-cyan-500"
                  />
                )}
                {displayResult.impact_summary.high_priority_affected > 0 && (
                  <ImpactRow
                    label="High priority"
                    value={displayResult.impact_summary.high_priority_affected}
                    total={displayResult.impact_summary.total_affected_shipments}
                    color="bg-amber-500"
                  />
                )}
              </div>
            </div>

            {/* AI Explanation (if available) */}
            {displayResult.explanation && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="text-sm font-semibold text-blue-800">ChainMind AI Analysis</span>
                  {displayResult.explanation.used_llm && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded ml-auto">
                      {displayResult.explanation.llm_provider?.toUpperCase() ?? 'AI'}
                    </span>
                  )}
                </div>
                {displayResult.explanation.crisis_summary && (
                  <p className="text-xs text-blue-700 leading-relaxed">
                    {displayResult.explanation.crisis_summary}
                  </p>
                )}
                {displayResult.explanation.explanation && displayResult.explanation.explanation !== displayResult.explanation.crisis_summary && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium">
                      Full analysis
                    </summary>
                    <p className="mt-2 text-blue-700 leading-relaxed whitespace-pre-line">
                      {displayResult.explanation.explanation}
                    </p>
                  </details>
                )}
              </div>
            )}

            {/* Re-run result notice */}
            {reRunResult && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                Analysis re-run complete — showing updated results
              </div>
            )}

            {reRunError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                {reRunError}
              </div>
            )}
          </div>
        )}

        {/* ── Actions ───────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 pt-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Actions</div>

          <div className="space-y-2">
            {/* Primary: View full AI analysis */}
            <button
              onClick={() => { onNavigate('ai-recommendations'); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors text-left shadow-sm"
            >
              <BrainCircuit className="w-4 h-4 flex-shrink-0" />
              <div>
                <div className="font-semibold">View AI Recommendations</div>
                <div className="text-xs text-blue-200">Full strategy analysis and recovery options</div>
              </div>
              <ArrowRight className="w-4 h-4 ml-auto flex-shrink-0 opacity-70" />
            </button>

            {/* Re-run analysis */}
            {!showReRunConfirm && !reRunning && (
              <button
                onClick={() => setShowReRunConfirm(true)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <RefreshCw className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div>
                  <div className="font-medium">Re-analyze Impact</div>
                  <div className="text-xs text-slate-400">Run fresh simulation with current network state</div>
                </div>
              </button>
            )}

            {showReRunConfirm && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                <p className="text-amber-800 font-medium mb-1">Re-run Impact Analysis?</p>
                <p className="text-amber-700 text-xs mb-3">
                  This will run a new simulation for <strong>{simulation.location}</strong> using current network data.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleReRun}
                    className="flex-1 btn-primary text-xs py-2"
                  >
                    <Zap className="w-3.5 h-3.5 inline mr-1" />
                    Confirm & Analyze
                  </button>
                  <button
                    onClick={() => setShowReRunConfirm(false)}
                    className="px-3 py-2 rounded-lg border border-amber-300 text-amber-700 text-xs hover:bg-amber-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {reRunning && (
              <div className="flex items-center gap-2 text-sm text-blue-600 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Running impact analysis…
              </div>
            )}

            {/* Crisis simulator */}
            <button
              onClick={() => { onNavigate('crisis-simulator'); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <Zap className="w-4 h-4 text-purple-500 flex-shrink-0" />
              <div>
                <div className="font-medium">Open Crisis Simulator</div>
                <div className="text-xs text-slate-400">Configure and run custom scenarios</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon, label, value, valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className={`text-base leading-tight ${valueClass ?? 'text-slate-900 font-semibold'}`}>{value}</div>
    </div>
  );
}

function ImpactRow({ label, value, total, color }: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-semibold text-slate-800">{value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
