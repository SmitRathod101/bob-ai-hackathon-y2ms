import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import DashboardTab from './components/DashboardTab';
import SimulationTab from './components/SimulationTab';
import WhatIfTab from './components/WhatIfTab';
import HistoryTab from './components/HistoryTab';
import { getDashboardSummary, type DashboardSummary } from './services/api';

type Tab = 'dashboard' | 'simulate' | 'whatif' | 'history';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardSummary();
      setDashboardData(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to connect to ChainMind backend';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        backendStatus={error ? 'error' : loading ? 'loading' : 'ok'}
      />

      <main className="flex-1 px-4 md:px-6 py-6 max-w-screen-2xl mx-auto w-full">
        {error && (
          <div className="mb-4 bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
            <strong>Backend connection error:</strong> {error}
            <button
              onClick={loadDashboard}
              className="ml-4 underline hover:text-red-200"
            >
              Retry
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <DashboardTab data={dashboardData} loading={loading} onRefresh={loadDashboard} />
        )}
        {activeTab === 'simulate' && (
          <SimulationTab
            ports={dashboardData?.ports ?? []}
            onSimulationComplete={() => {
              // Refresh dashboard after simulation
              loadDashboard();
            }}
          />
        )}
        {activeTab === 'whatif' && (
          <WhatIfTab />
        )}
        {activeTab === 'history' && (
          <HistoryTab recentSimulations={dashboardData?.recent_simulations ?? []} />
        )}
      </main>

      <footer className="text-center text-slate-600 text-xs py-4 border-t border-slate-800">
        ChainMind AI — Supply Chain Crisis Simulator &copy; 2025 | IBM Bobathon
      </footer>
    </div>
  );
}
