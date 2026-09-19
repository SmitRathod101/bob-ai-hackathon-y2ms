import ManualModeTab from './ManualModeTab';
import { Settings } from 'lucide-react';

interface ManualModePageProps {
  onSimulationComplete?: () => void;
  onNavigate?: (section: string) => void;
}

export default function ManualModePage({ onSimulationComplete, onNavigate }: ManualModePageProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-500" />
          Manual Mode
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Set environmental conditions and inject direct disruptions — the causal engine computes cascading impact
        </p>
      </div>
      <ManualModeTab onSimulationComplete={onSimulationComplete} onNavigate={onNavigate} />
    </div>
  );
}
