import { useState, useEffect } from 'react';
import { getSimulations, type SimulationSummary } from '../services/api';
import { formatCurrency } from '../utils/format';
import DetailDrawer from './DetailDrawer';
import DisruptionDetailPanel from './DisruptionDetailPanel';
import AIAnalysisPanel from './AIAnalysisPanel';
import {
  AlertTriangle, RefreshCw, Zap, Clock, MapPin,
  BrainCircuit, ChevronRight,
} from 'lucide-react';

function severityConfig(s: string) {
  switch (s) {
    case 'high':   return { cls: 'badge-critical', dotCls: 'bg-red-500' };
    case 'medium': return { cls: 'badge-high',     dotCls: 'bg-amber-500' };
    default:       return { cls: 'badge-low',      dotCls: 'bg-green-500' };
  }
}

function disruptionIcon(type: string) {
  if (type.includes('flood') || type.includes('weather')) return '🌊';
  if (type.includes('port'))  return '⚓';
  if (type.includes('road') || type.includes('landslide')) return '🏔';
  if (type.includes('rail'))  return '🚆';
  if (type.includes('cold'))  return '❄️';
  return '⚠️';
}

interface DisruptionsPageProps {
  onNavigate?: (section: string) => void;
}

export default function DisruptionsPage({ onNavigate }: DisruptionsPageProps = {}) {
  const [sims, setSims] = useState<SimulationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerSim, setDrawerSim] = useState<SimulationSummary | null>(null);
  const [drawerMode, setDrawerMode] = useState<'disruption' | 'ai'>('disruption');

  const nav = onNavigate ?? (() => {});

  const load = async () => {
    setLoading(true);
    try {
      const data = await getSimulations();
      setSims(data);
    } catch {
      setSims([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openDisruption = (sim: SimulationSummary) => {
    setDrawerSim(sim);
    setDrawerMode('disruption');
  };
  const openAI = (sim: SimulationSummary) => {
    setDrawerSim(sim);
    setDrawerMode('ai');
  };

  const active  = sims.filter(s => s.status === 'completed' && s.total_affected_shipments > 0);
  const byType  = active.reduce<Record<string, number>>((acc, s) => {
    acc[s.disruption_type] = (acc[s.disruption_type] ?? 0) + 1;
    return acc;
  }, {});
  const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
  const totalExposed = active.reduce((sum, s) => sum + (s.total_cargo_value_exposed ?? 0), 0);
  const avgDelay = active.length > 0
    ? active.reduce((sum, s) => sum + (s.average_delay_hours ?? 0), 0) / active.length
    : 0;

  return (
    <>
      {/* Detail Drawer */}
      <DetailDrawer
        open={!!drawerSim}
        onClose={() => setDrawerSim(null)}
        title={drawerMode === 'ai' ? 'ChainMind AI Analysis' : 'Disruption Details'}
        subtitle={drawerSim ? `${drawerSim.location} · ${drawerSim.disruption_type?.replace(/_/g, ' ')}` : undefined}
        width="lg"
      >
        {drawerSim && drawerMode === 'disruption' && (
          <DisruptionDetailPanel
            simulation={drawerSim}
            onNavigate={nav}
            onClose={() => setDrawerSim(null)}
          />
        )}
        {drawerSim && drawerMode === 'ai' && (
          <AIAnalysisPanel
            simulation={drawerSim}
            onNavigate={nav}
            onClose={() => setDrawerSim(null)}
          />
        )}
      </DetailDrawer>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Disruptions
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">Crisis simulations and active network disruptions</p>
          </div>
          <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-red-200 bg-red-50 shadow-sm p-3">
            <div className="text-2xl font-bold text-red-700">{active.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">Total Disruptions</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 shadow-sm p-3">
            <div className="text-2xl font-bold text-amber-700">{active.reduce((s, d) => s + d.total_affected_shipments, 0)}</div>
            <div className="text-xs text-slate-500 mt-0.5">Shipments Affected</div>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 shadow-sm p-3">
            <div className="text-lg font-bold text-violet-700 truncate">{formatCurrency(totalExposed)}</div>
            <div className="text-xs text-slate-500 mt-0.5">Cargo Exposed</div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 shadow-sm p-3">
            <div className="text-2xl font-bold text-blue-700">{avgDelay.toFixed(1)}h</div>
            <div className="text-xs text-slate-500 mt-0.5">Avg Delay</div>
          </div>
        </div>

        {/* Top disruption type */}
        {topType && (
          <div className="card">
            <div className="card-body py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl flex-shrink-0">
                {disruptionIcon(topType[0])}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800 capitalize">{topType[0].replace(/_/g, ' ')}</div>
                <div className="text-xs text-slate-400">Most frequent disruption type · {topType[1]} occurrences</div>
              </div>
              <div className="ml-auto text-xs text-amber-600 font-semibold">HIGHEST FREQUENCY</div>
            </div>
          </div>
        )}

        {/* Disruption list */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><div className="loading-spinner" /></div>
          ) : sims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <Zap className="w-10 h-10 mb-3 opacity-50 text-slate-400" />
                <p className="text-sm font-medium">No disruption records found</p>
                <p className="text-xs mt-1 text-slate-400">Run a Crisis Simulation to generate disruption records</p>
              </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sims.map(sim => {
                const sc = severityConfig(sim.severity);
                return (
                  <div key={sim.simulation_id}
                    className="px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sc.dotCls}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm text-slate-800 font-medium truncate">
                          {sim.scenario_name || sim.location}
                        </span>
                        <span className={`badge text-[10px] flex-shrink-0 ${sc.cls}`}>{sim.severity}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{sim.location}
                        </span>
                        <span className="capitalize">{sim.disruption_type?.replace(/_/g, ' ')}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{sim.duration_hours}h
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 mr-2">
                      <div className={`text-sm font-semibold ${(sim.total_affected_shipments ?? 0) > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                        {sim.total_affected_shipments}
                      </div>
                      <div className="text-[10px] text-slate-400">affected</div>
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-1.5 flex-shrink-0 items-center">
                      <button
                        onClick={() => openDisruption(sim)}
                        className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                      >
                        <ChevronRight className="w-3 h-3" />
                        Details
                      </button>
                      {sim.recommended_strategy && (
                        <button
                          onClick={() => openAI(sim)}
                          className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded transition-colors"
                        >
                          <BrainCircuit className="w-3 h-3" />
                          AI Analysis
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {sims.length > 0 && (
          <div className="text-xs text-slate-400 text-center">
            Showing {sims.length} simulation{sims.length !== 1 ? 's' : ''} · Click "Details" or "AI Analysis" to investigate
          </div>
        )}
      </div>
    </>
  );
}
