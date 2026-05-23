import React, { useState } from 'react';
import { useStadiumData, useAutoAnalysis } from './hooks/useStadiumData.js';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import MetricCards from './components/MetricCards.jsx';
import GateGrid from './components/GateGrid.jsx';
import ZoneMap from './components/ZoneMap.jsx';
import CrowdChart from './components/CrowdChart.jsx';
import IncidentFeed from './components/IncidentFeed.jsx';
import AICommandPanel from './components/AICommandPanel.jsx';
import AlertBanner from './components/AlertBanner.jsx';
import LoadingSkeleton from './components/LoadingSkeleton.jsx';

// Auth Imports
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import AuthPage from './components/AuthPage.jsx';
import ProfileView from './components/ProfileView.jsx';

function MainApp() {
  const { currentUser, loading: authLoading } = useAuth();
  const { state, loading, error } = useStadiumData(3000);
  const analysis = useAutoAnalysis(8000);
  const [activeView, setActiveView] = useState('dashboard');
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  if (authLoading) return <LoadingSkeleton />;
  if (!currentUser) return <AuthPage />;
  if (loading && !state) return <LoadingSkeleton />;

  return (
    <div className="flex h-screen bg-midnight-900 overflow-hidden">
      <div className="noise-overlay" />

      <Sidebar activeView={activeView} setActiveView={setActiveView} />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <TopBar
          state={state}
          analysis={analysis}
          onOpenAI={() => setAiPanelOpen(true)}
        />

        {analysis && analysis.overallRisk !== 'low' && (
          <AlertBanner analysis={analysis} />
        )}

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">
          {activeView === 'dashboard' && state && (
            <>
              <MetricCards state={state} analysis={analysis} />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="xl:col-span-2">
                  <CrowdChart history={state.crowdHistory} capacity={state.capacity} />
                </div>
                <div>
                  <ZoneMap zones={state.zones} />
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <GateGrid gates={state.gates} />
                <IncidentFeed incidents={state.incidents} />
              </div>
            </>
          )}

          {activeView === 'gates' && state && (
            <GateGrid gates={state.gates} expanded />
          )}

          {activeView === 'zones' && state && (
            <ZoneMap zones={state.zones} expanded />
          )}

          {activeView === 'incidents' && state && (
            <IncidentFeed incidents={state.incidents} expanded />
          )}

          {activeView === 'ai' && (
            <AICommandPanel embedded />
          )}

          {activeView === 'profile' && (
            <ProfileView />
          )}
        </main>
      </div>

      {aiPanelOpen && (
        <AICommandPanel
          onClose={() => setAiPanelOpen(false)}
          overlay
        />
      )}

      {error && (
        <div className="fixed bottom-4 right-4 z-50 bg-alert-500/90 text-white px-4 py-3 rounded-xl text-sm font-medium backdrop-blur-sm animate-slide-up">
          Connection issue: {error}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
