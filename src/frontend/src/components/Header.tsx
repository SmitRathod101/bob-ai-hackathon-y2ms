import { Activity, Zap, GitCompare, Clock, Settings, Bot, Cpu } from 'lucide-react';

type Tab = 'dashboard' | 'simulate' | 'whatif' | 'history' | 'manual' | 'auto';

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  backendStatus: 'ok' | 'loading' | 'error';
}

export default function Header({ activeTab, onTabChange, backendStatus }: HeaderProps) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard',    icon: <Activity className="w-4 h-4" /> },
    { id: 'simulate',  label: 'Simulate',     icon: <Zap className="w-4 h-4" /> },
    { id: 'manual',    label: 'Manual Mode',  icon: <Settings className="w-4 h-4" /> },
    { id: 'auto',      label: 'Auto Mode',    icon: <Bot className="w-4 h-4" />, badge: 'R2' },
    { id: 'whatif',    label: 'What-If',      icon: <GitCompare className="w-4 h-4" /> },
    { id: 'history',   label: 'History',      icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50 shadow-lg shadow-black/20">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between py-2.5 border-b border-slate-800/70">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-bold text-base leading-tight tracking-tight">ChainMind AI</h1>
                <span className="hidden sm:inline text-xs bg-blue-900/60 text-blue-300 border border-blue-700/60 px-1.5 py-0.5 rounded font-mono">
                  Round 2
                </span>
              </div>
              <p className="text-slate-500 text-xs">AI Supply Chain Crisis Simulator · IBM Bobathon</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                <span>India Logistics Digital Twin</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                <span>250 Shipments</span>
              </div>
            </div>

            {/* Backend status */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              <div className={`w-1.5 h-1.5 rounded-full ${
                backendStatus === 'ok' ? 'bg-green-500' :
                backendStatus === 'loading' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500 animate-pulse'
              }`} />
              <span className={`text-xs font-medium ${
                backendStatus === 'ok' ? 'text-green-400' :
                backendStatus === 'loading' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {backendStatus === 'ok' ? 'Backend Online' :
                 backendStatus === 'loading' ? 'Connecting...' :
                 'Backend Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-0.5 py-1.5 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge && (
                <span className={`text-xs px-1 py-0.5 rounded font-mono leading-none ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-blue-100'
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
