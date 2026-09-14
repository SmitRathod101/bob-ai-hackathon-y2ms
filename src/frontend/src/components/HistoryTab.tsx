import { useState, useEffect } from 'react';
import type { SimulationSummary } from '../services/api';
import { getSimulations } from '../services/api';
import { formatCurrency, formatDelay } from '../utils/format';
import { Clock, RefreshCw } from 'lucide-react';

interface HistoryTabProps {
  recentSimulations: SimulationSummary[];
}

export default function HistoryTab({ recentSimulations }: HistoryTabProps) {
  const [allSims, setAllSims] = useState<SimulationSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getSimulations();
      setAllSims(data);
    } catch {
      setAllSims(recentSimulations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sims = allSims.length > 0 ? allSims : recentSimulations;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Simulation History</h2>
          <p className="text-slate-400 text-sm mt-0.5">All previous crisis simulations</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="loading-spinner" />
          Loading...
        </div>
      )}

      {sims.length === 0 && !loading && (
        <div className="card p-10 text-center text-slate-400">
          <Clock className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p>No simulations yet. Run a crisis simulation to get started.</p>
        </div>
      )}

      {sims.length > 0 && (
        <div className="card">
          <div className="card-body p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 font-medium px-5 py-3">Scenario</th>
                  <th className="text-left text-slate-400 font-medium px-4 py-3">Type</th>
                  <th className="text-center text-slate-400 font-medium px-4 py-3">Severity</th>
                  <th className="text-right text-slate-400 font-medium px-4 py-3">Affected</th>
                  <th className="text-right text-slate-400 font-medium px-4 py-3">Cargo Exposed</th>
                  <th className="text-right text-slate-400 font-medium px-4 py-3">Avg Delay</th>
                  <th className="text-right text-slate-400 font-medium px-4 py-3">Recommended</th>
                  <th className="text-right text-slate-400 font-medium px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {sims.map(sim => (
                  <tr key={sim.simulation_id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="px-5 py-3">
                      <div className="text-slate-200 font-medium">{sim.scenario_name || sim.location}</div>
                      <div className="text-slate-500 text-xs font-mono">{sim.simulation_id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs capitalize">
                      {sim.disruption_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge capitalize ${
                        sim.severity === 'high' ? 'badge-critical' :
                        sim.severity === 'medium' ? 'badge-high' : 'badge-low'
                      }`}>
                        {sim.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 font-medium">
                      {sim.total_affected_shipments}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {formatCurrency(sim.total_cargo_value_exposed)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {formatDelay(sim.average_delay_hours)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-400 capitalize">
                      {sim.recommended_strategy ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">
                      {sim.created_at ? new Date(sim.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
