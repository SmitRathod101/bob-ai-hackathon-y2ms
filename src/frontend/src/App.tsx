import { useState, useEffect, useCallback } from 'react';
import Sidebar, { type NavSection } from './components/Sidebar';
import TopBar from './components/TopBar';
import OverviewDashboard from './components/OverviewDashboard';
import ShipmentsPage from './components/ShipmentsPage';
import NetworkPage from './components/NetworkPage';
import DisruptionsPage from './components/DisruptionsPage';
import AIRecommendationsPage from './components/AIRecommendationsPage';
import CrisisSimulatorPage from './components/CrisisSimulatorPage';
import WhatIfPage from './components/WhatIfPage';
import NetworkHealthPage from './components/NetworkHealthPage';
import HistoryPage from './components/HistoryPage';
import ManualModePage from './components/ManualModePage';
import { getDashboardSummary, type DashboardSummary } from './services/api';

export default function App() {
  const [section, setSection] = useState<NavSection>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const alertCount = dashboardData
    ? dashboardData.delayed +
      dashboardData.ports.filter(p => p.operational_status !== 'operational').length
    : 0;

  const backendStatus: 'ok' | 'loading' | 'error' =
    error ? 'error' : loading ? 'loading' : 'ok';

  return (
    <div className="app-shell">
      <Sidebar
        active={section}
        onChange={setSection}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(v => !v)}
      />

      <div className="app-main">
        <TopBar
          section={section}
          backendStatus={backendStatus}
          onRefresh={loadDashboard}
          alertCount={alertCount}
        />

        <div className="app-content">
          {/* Backend error banner */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-3">
              <span className="font-semibold">Backend connection error:</span>
              <span className="flex-1">{error}</span>
              <button
                onClick={loadDashboard}
                className="text-red-700 underline hover:text-red-900 font-medium flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {section === 'overview' && (
            <OverviewDashboard
              data={dashboardData}
              loading={loading}
              onNavigate={setSection as (s: string) => void}
            />
          )}
          {section === 'shipments' && <ShipmentsPage />}
          {section === 'network'   && <NetworkPage />}
          {section === 'disruptions' && <DisruptionsPage onNavigate={setSection as (s: string) => void} />}
          {section === 'ai-recommendations' && <AIRecommendationsPage />}
          {section === 'crisis-simulator' && (
            <CrisisSimulatorPage
              ports={dashboardData?.ports ?? []}
              onSimulationComplete={loadDashboard}
              onNavigate={setSection as (s: string) => void}
            />
          )}
          {section === 'manual-mode' && (
            <ManualModePage
              onSimulationComplete={loadDashboard}
              onNavigate={setSection as (s: string) => void}
            />
          )}
          {section === 'whatif' && <WhatIfPage />}
          {section === 'network-health' && <NetworkHealthPage />}
          {section === 'history' && (
            <HistoryPage recentSimulations={dashboardData?.recent_simulations ?? []} />
          )}
        </div>
      </div>
    </div>
  );
}
