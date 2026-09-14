import { Activity, Zap, GitCompare, Clock } from 'lucide-react';

type Tab = 'dashboard' | 'simulate' | 'whatif' | 'history';

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  backendStatus: 'ok' | 'loading' | 'error';
}

export default function Header({ activeTab, onTabChange, backendStatus }: HeaderProps) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity className="w-4 h-4" /> },
    { id: 'simulate', label: 'Simulate Crisis', icon: <Zap className="w-4 h-4" /> },
    { id: 'whatif', label: 'What-If Compare', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">ChainMind AI</h1>
              <p className="text-slate-500 text-xs">Supply Chain Crisis Simulator</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs">
              <span className="text-slate-500">India Logistics Digital Twin</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500">250 Shipments Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${
                backendStatus === 'ok' ? 'bg-green-500' :
                backendStatus === 'loading' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
              }`} />
              <span className={`text-xs ${
                backendStatus === 'ok' ? 'text-green-400' :
                backendStatus === 'loading' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {backendStatus === 'ok' ? 'Online' :
                 backendStatus === 'loading' ? 'Connecting...' :
                 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex gap-1 py-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
