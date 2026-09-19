import {
  LayoutDashboard, Package, Network, AlertTriangle,
  BrainCircuit, Zap, GitCompare, BarChart3, Clock,
  ChevronRight, Cpu, Activity, Settings,
} from 'lucide-react';

export type NavSection =
  | 'overview'
  | 'shipments'
  | 'network'
  | 'disruptions'
  | 'ai-recommendations'
  | 'crisis-simulator'
  | 'manual-mode'
  | 'whatif'
  | 'network-health'
  | 'history';

interface SidebarProps {
  active: NavSection;
  onChange: (s: NavSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'OPERATIONS',
    items: [
      { id: 'overview',   label: 'Overview',    icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'shipments',  label: 'Shipments',   icon: <Package className="w-4 h-4" /> },
      { id: 'network',    label: 'Network',     icon: <Network className="w-4 h-4" /> },
    ],
  },
  {
    heading: 'INTELLIGENCE',
    items: [
      { id: 'disruptions',        label: 'Disruptions',        icon: <AlertTriangle className="w-4 h-4" /> },
      { id: 'ai-recommendations', label: 'AI Recommendations', icon: <BrainCircuit className="w-4 h-4" />, badge: 'AI' },
    ],
  },
  {
    heading: 'SIMULATION',
    items: [
      { id: 'crisis-simulator', label: 'Crisis Simulator', icon: <Zap className="w-4 h-4" /> },
      { id: 'manual-mode',      label: 'Manual Mode',      icon: <Settings className="w-4 h-4" /> },
      { id: 'whatif',           label: 'What-If Analysis', icon: <GitCompare className="w-4 h-4" /> },
    ],
  },
  {
    heading: 'ANALYTICS',
    items: [
      { id: 'network-health', label: 'Network Health', icon: <BarChart3 className="w-4 h-4" /> },
      { id: 'history',        label: 'History',        icon: <Clock className="w-4 h-4" /> },
    ],
  },
];

export default function Sidebar({ active, onChange, collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <aside
      className={`flex flex-col bg-white border-r border-slate-200 transition-all duration-200 flex-shrink-0 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
      style={{ boxShadow: '1px 0 0 0 #e2e8f0' }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 px-3 py-4 border-b border-slate-200 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
          <Cpu className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 leading-tight tracking-tight">ChainMind</div>
            <div className="text-xs text-slate-400 leading-tight">Control Center</div>
          </div>
        )}
      </div>

      {/* ── Nav groups ────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.heading} className="mb-3">
            {!collapsed && (
              <div className="px-2 mb-1">
                <span className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase">
                  {group.heading}
                </span>
              </div>
            )}
            {collapsed && <div className="border-t border-slate-200 my-2 mx-1" />}
            {group.items.map((item) => {
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChange(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all duration-150 group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left font-medium truncate">{item.label}</span>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold leading-none ${
                          isActive
                            ? 'bg-white/30 text-white'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-3 h-3 text-white/70 flex-shrink-0" />}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer: live indicator + collapse toggle ──────────────────────── */}
      <div className="px-2 py-3 border-t border-slate-200 space-y-2">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <Activity className="w-3 h-3 text-emerald-600 flex-shrink-0" />
            <span className="text-xs text-emerald-700 font-medium">India Digital Twin</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
