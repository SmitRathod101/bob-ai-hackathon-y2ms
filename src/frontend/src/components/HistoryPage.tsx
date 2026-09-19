import HistoryTab from './HistoryTab';
import AutoModeTab from './AutoModeTab';
import type { SimulationSummary } from '../services/api';
import { Clock } from 'lucide-react';
import { useState } from 'react';

interface HistoryPageProps {
  recentSimulations: SimulationSummary[];
}

export default function HistoryPage({ recentSimulations }: HistoryPageProps) {
  const [mode, setMode] = useState<'standard' | 'auto'>('standard');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-500" />
          History
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">Previous simulations and autonomous monitoring runs</p>
      </div>

      {/* Mode switcher */}
      <div className="flex gap-1 border-b border-slate-200 pb-1">
        {(['standard', 'auto'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
            }`}
          >
            {m === 'standard' ? 'Simulation History' : 'Auto Mode Runs'}
          </button>
        ))}
      </div>

      {mode === 'standard' && <HistoryTab recentSimulations={recentSimulations} />}
      {mode === 'auto'     && <AutoModeTab />}
    </div>
  );
}
