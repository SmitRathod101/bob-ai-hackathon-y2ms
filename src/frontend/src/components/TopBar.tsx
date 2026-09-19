import { useState } from 'react';
import { Search, Bell, RefreshCw, ChevronRight } from 'lucide-react';
import type { NavSection } from './Sidebar';

const SECTION_LABELS: Record<NavSection, string> = {
  'overview':           'Overview',
  'shipments':          'Shipments',
  'network':            'Network',
  'disruptions':        'Disruptions',
  'ai-recommendations': 'AI Recommendations',
  'crisis-simulator':   'Crisis Simulator',
  'manual-mode':        'Manual Mode',
  'whatif':             'What-If Analysis',
  'network-health':     'Network Health',
  'history':            'History',
};

const SECTION_GROUP: Record<NavSection, string> = {
  'overview':           'Operations',
  'shipments':          'Operations',
  'network':            'Operations',
  'disruptions':        'Intelligence',
  'ai-recommendations': 'Intelligence',
  'crisis-simulator':   'Simulation',
  'manual-mode':        'Simulation',
  'whatif':             'Simulation',
  'network-health':     'Analytics',
  'history':            'Analytics',
};

interface TopBarProps {
  section: NavSection;
  backendStatus: 'ok' | 'loading' | 'error';
  onRefresh: () => void;
  alertCount?: number;
}

export default function TopBar({ section, backendStatus, onRefresh, alertCount = 0 }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  const statusLabel =
    backendStatus === 'ok'      ? 'LIVE' :
    backendStatus === 'loading' ? 'CONNECTING' :
                                  'OFFLINE';

  const statusClass =
    backendStatus === 'ok'      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    backendStatus === 'loading' ? 'bg-amber-50   text-amber-700  border-amber-200' :
                                  'bg-red-50     text-red-700    border-red-200';

  const dotClass =
    backendStatus === 'ok'      ? 'bg-emerald-500' :
    backendStatus === 'loading' ? 'bg-amber-500 animate-pulse' :
                                  'bg-red-500 animate-pulse';

  return (
    <header
      className="h-12 bg-white border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0"
      style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm min-w-0">
        <span className="text-slate-400 hidden sm:block">{SECTION_GROUP[section]}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:block" />
        <span className="text-slate-800 font-semibold">{SECTION_LABELS[section]}</span>
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className="hidden md:flex items-center">
        {searchOpen ? (
          <input
            autoFocus
            type="text"
            placeholder="Search shipments, routes, ports…"
            onBlur={() => setSearchOpen(false)}
            className="bg-white border border-slate-300 text-slate-800 rounded-lg px-3 py-1 text-sm w-60 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400 shadow-sm"
          />
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1 text-sm transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search…</span>
          </button>
        )}
      </div>

      {/* Alert bell */}
      <button className="relative p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
        <Bell className="w-4 h-4" />
        {alertCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        title="Refresh data"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      {/* Status badge */}
      <div className={`flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${statusClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
        {statusLabel}
      </div>
    </header>
  );
}
