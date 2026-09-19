/**
 * CrisisSimulatorPage — Unified Crisis Simulation Control Center
 *
 * Mode A: Standard Crisis Simulation (SimulationTab)
 *   Configure disruption type, location, duration, severity → run deterministic
 *   13-step simulation engine → impact + AI strategy + Digital Twin update
 *
 * Mode B: Autonomous Monitoring (AutoModeTab)
 *   Select location + condition scenario → start/pause/resume/stop the
 *   continuous causal-detection loop → watch the Digital Twin respond live
 */

import { useState } from 'react';
import SimulationTab from './SimulationTab';
import AutoModeTab from './AutoModeTab';
import type { Port } from '../services/api';
import { Zap, Activity, ChevronRight } from 'lucide-react';

type SimMode = 'standard' | 'auto';

interface CrisisSimulatorPageProps {
  ports: Port[];
  onSimulationComplete: () => void;
  onNavigate?: (section: string) => void;
}

export default function CrisisSimulatorPage({
  ports,
  onSimulationComplete,
  onNavigate,
}: CrisisSimulatorPageProps) {
  const [mode, setMode] = useState<SimMode>('standard');

  return (
    <div className="space-y-5">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Crisis Simulator
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Simulate supply chain disruptions and generate AI-powered recovery strategies
          </p>
        </div>

        {/* Breadcrumb hint */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
          <span>Control Center</span>
          <ChevronRight className="w-3 h-3" />
          <span>Simulation</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-700 font-medium">
            {mode === 'standard' ? 'Standard Crisis' : 'Auto Monitoring'}
          </span>
        </div>
      </div>

      {/* ── Mode selector ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 max-w-2xl">
        <ModeCard
          active={mode === 'standard'}
          onClick={() => setMode('standard')}
          icon={<Zap className="w-5 h-5" />}
          title="Standard Crisis Simulation"
          description="Configure a specific disruption scenario and run the full 13-step impact engine to see cascading effects, affected shipments, and AI recovery strategies instantly."
          badge="INSTANT"
          badgeColor="amber"
        />
        <ModeCard
          active={mode === 'auto'}
          onClick={() => setMode('auto')}
          icon={<Activity className="w-5 h-5" />}
          title="Autonomous Monitoring"
          description="Start continuous causal monitoring at a location. ChainMind automatically detects threshold violations and triggers crisis analysis in real time."
          badge="LIVE"
          badgeColor="emerald"
        />
      </div>

      {/* ── Mode content ─────────────────────────────────────────────────── */}
      {mode === 'standard' && (
        <SimulationTab
          ports={ports}
          onSimulationComplete={onSimulationComplete}
          onNavigate={onNavigate}
        />
      )}

      {mode === 'auto' && (
        <AutoModeTab onNavigate={onNavigate} />
      )}
    </div>
  );
}

// ── ModeCard ─────────────────────────────────────────────────────────────────

function ModeCard({
  active,
  onClick,
  icon,
  title,
  description,
  badge,
  badgeColor,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  badgeColor: 'amber' | 'emerald';
}) {
  const badgeCls = {
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }[badgeColor];

  const iconCls = {
    amber:   'bg-amber-100 text-amber-600',
    emerald: 'bg-emerald-100 text-emerald-600',
  }[badgeColor];

  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border-2 p-4 transition-all duration-150 ${
        active
          ? 'border-blue-500 bg-blue-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          active ? 'bg-blue-600 text-white' : iconCls
        }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-sm font-semibold ${active ? 'text-blue-900' : 'text-slate-800'}`}>
              {title}
            </span>
            <span className={`text-[10px] font-bold border rounded px-1.5 py-0.5 ${
              active ? 'bg-blue-100 text-blue-700 border-blue-200' : badgeCls
            }`}>
              {badge}
            </span>
          </div>
          <p className={`text-xs leading-relaxed ${active ? 'text-blue-700' : 'text-slate-500'}`}>
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}
