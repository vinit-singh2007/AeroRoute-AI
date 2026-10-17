// AeroRoute — Main Application Dashboard (Mumbai Autonomous Fleet)
import { useState, useMemo, useEffect } from 'react';
import {
  Satellite,
  Clock,
  Map,
  BarChart3,
  Shield,
  Layers,
  Cpu,
  Radio,
  Home,
  Navigation,
  X,
  Database
} from 'lucide-react';
import FleetMap          from './components/FleetMap';
import DispatchPanel     from './components/DispatchPanel';
import TelemetryHUD      from './components/TelemetryHUD';
import FleetOverview     from './components/FleetOverview';
import EmergencyControls from './components/EmergencyControls';
import LandingPage       from './components/LandingPage';
import MissionsDeliveriesPage from './components/MissionsDeliveriesPage';
import PredictionsPanel  from './components/PredictionsPanel';
import VerticalNavRail   from './components/VerticalNavRail';
import { ToastContainer } from './components/Toast';
import { useTelemetry }  from './hooks/useTelemetry';
import { getDatabaseStatus } from './services/api';



function NavBar({ connected, lastUpdate, dronesCount, dbStatus, currentView, onViewChange }) {
  const time = lastUpdate
    ? lastUpdate.toLocaleTimeString('en-IN', { hour12: false })
    : '--:--:--';

  const isDbOnline = dbStatus?.status === 'CONNECTED';

  return (
    <nav className="top-nav">
      <div className="nav-logo" style={{ cursor: 'pointer' }} onClick={() => onViewChange('landing')}>
        <div className="nav-logo-icon">✈️</div>
        <div>
          <div className="nav-logo-text">AeroRoute</div>
          <div className="nav-logo-sub">Mumbai Drone Dispatch Platform</div>
        </div>
      </div>

      {/* Clean Navbar: Logo on left, Live Status Bar on right */}

      <div className="nav-status-bar">
        <div
          className="nav-status-item"
          title={isDbOnline ? `MongoDB Connected: ${dbStatus.database} (v${dbStatus.version}) • Drones: ${dbStatus.counts?.drones || 0}, Missions: ${dbStatus.counts?.missions || 0}` : 'Connecting to MongoDB...'}
          style={{ cursor: 'pointer' }}
        >
          <Database size={12} style={{ color: isDbOnline ? 'var(--brand-success, #00ffaa)' : 'var(--brand-warning, #ffaa00)' }} />
          <span>{isDbOnline ? 'MongoDB: Online' : 'MongoDB: Syncing'}</span>
        </div>
        <div className="nav-status-item">
          <Satellite size={12} />
          <span>{dronesCount} Drones Active</span>
        </div>
        <div className="nav-status-item">
          <Clock size={12} />
          <span className="text-mono">{time}</span>
        </div>
        <div className="nav-status-item">
          <Cpu size={12} />
          <span>GA + Fuzzy Engine</span>
        </div>
        <div className={`ws-badge ${connected ? 'connected' : 'disconnected'}`}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div className={`pulse-dot ${connected ? '' : 'danger'}`} />
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  const {
    drones,
    hub,
    connected,
    lastUpdate,
    simulateStorm,
    forceRTB,
    resetFleet,
    clearFleet,
  } = useTelemetry();

  const [currentView,        setCurrentView]        = useState('landing');
  const [selectedDroneId,    setSelectedDroneId]    = useState(null);
  const [routeResult,        setRouteResult]        = useState(null);
  const [mapPinnedDest,      setMapPinnedDest]      = useState(null);
  const [activeNav,          setActiveNav]          = useState('dispatch');
  const [isDrawerOpen,       setIsDrawerOpen]       = useState(true);
  const [isNavCollapsed,     setIsNavCollapsed]     = useState(false);
  const [dbStatus,           setDbStatus]           = useState(null);

  // Poll database status periodically
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await getDatabaseStatus();
        if (isMounted) setDbStatus(res);
      } catch {
        if (isMounted) setDbStatus({ status: 'OFFLINE' });
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Auto-select first drone once telemetry stream populates, or clear if fleet is empty
  useEffect(() => {
    if (drones.length === 0) {
      if (selectedDroneId !== null) setSelectedDroneId(null);
    } else if (!selectedDroneId || !drones.some(d => d.id === selectedDroneId)) {
      setSelectedDroneId(drones[0].id);
    }
  }, [drones, selectedDroneId]);

  return (
    <>
      {/* Background Ambience */}
      <div className="bg-grid" />
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <div className="app-layout">
        {/* Navigation Bar */}
        <NavBar
          connected={connected}
          lastUpdate={lastUpdate}
          dronesCount={drones.length}
          dbStatus={dbStatus}
          currentView={currentView}
          onViewChange={setCurrentView}
        />

        {/* View 1: Landing Page */}
        {currentView === 'landing' && (
          <LandingPage
            onLaunchDashboard={() => {
              setCurrentView('dashboard');
              setActiveNav('dispatch');
              setIsDrawerOpen(true);
            }}
            onOpenPredictions={() => setCurrentView('missions')}
            onOpenMissions={() => setCurrentView('missions')}
            activeDronesCount={drones.length}
          />
        )}

        {/* View 2: Mission Control Dashboard */}
        {currentView === 'dashboard' && (
          <div className="main-content">

            {/* ── FAR LEFT: Vertical Website Navigation Sidebar (Glassmorphic Rail) ── */}
            <VerticalNavRail
              activeItem={activeNav}
              onSelectItem={(item) => {
                if (activeNav === item && isDrawerOpen) {
                  setIsDrawerOpen(false);
                } else {
                  setActiveNav(item);
                  setIsDrawerOpen(true);
                }
              }}
              isDrawerOpen={isDrawerOpen}
              onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
              isCollapsed={isNavCollapsed}
              onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
              onNavigateView={setCurrentView}
              currentView={currentView}
              dronesCount={drones.length}
            />

            {/* ── ADJACENT DRAWER: Section Content (Opens when any sidebar item is clicked) ── */}
            {isDrawerOpen && (
              <div className="sidebar" style={{
                width: 350,
                minWidth: 350,
                maxWidth: 350,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid var(--border-subtle)',
                background: 'rgba(5, 12, 24, 0.95)',
                transition: 'all 200ms ease',
              }}>
                {/* Drawer Header */}
                <div style={{
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'rgba(8, 16, 33, 0.85)',
                  flexShrink: 0,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 11,
                    fontWeight: 800,
                    color: 'var(--brand-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                  }}>
                    {activeNav === 'dispatch' && <><span>🚀</span> Mission Dispatch</>}
                    {activeNav === 'fleet' && <><span>🚁</span> Fleet Management</>}
                    {activeNav === 'ai-predict' && <><span>⚡</span> AI Predictions Engine</>}
                    {activeNav === 'safety' && <><span>🛡️</span> Flight Safety & Controls</>}
                  </div>

                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    title="Close Panel (Expand Map)"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 4,
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Drawer Body */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {activeNav === 'dispatch' && (
                    <DispatchPanel
                      onRouteResult={setRouteResult}
                      onBatteryResult={() => {}}
                      mapPinnedDestination={mapPinnedDest}
                      drones={drones}
                      onRefreshFleet={() => {}}
                      onNavigateToPredictions={() => setCurrentView('missions')}
                      onNavigateToMissions={() => setCurrentView('missions')}
                    />
                  )}
                  {activeNav === 'fleet' && (
                    <FleetOverview
                      drones={drones}
                      selectedDroneId={selectedDroneId}
                      onDroneSelect={setSelectedDroneId}
                    />
                  )}
                  {activeNav === 'ai-predict' && (
                    <PredictionsPanel
                      onRouteResult={setRouteResult}
                    />
                  )}
                  {activeNav === 'safety' && (
                    <EmergencyControls
                      onSimulateStorm={simulateStorm}
                      onForceRTB={forceRTB}
                      onReset={resetFleet}
                      onClearFleet={clearFleet}
                      selectedDrone={drones.find(d => d.id === selectedDroneId)}
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── CENTER PANEL: Mumbai Interactive Map ── */}
            <div className="map-area">
              <div className="map-overlay-top">
                <div className="map-chip">
                  <div className="pulse-dot" />
                  Mumbai Fleet Active ({drones.length})
                </div>
                <div className="map-chip">
                  <Layers size={10} />
                  CSMIA / BARC / Naval NFZ Guarded
                </div>
                {mapPinnedDest && (
                  <div className="map-chip" style={{ borderColor: 'rgba(6,255,165,0.4)', color: 'var(--brand-accent)' }}>
                    🎯 Target Pinned: {mapPinnedDest.lat.toFixed(3)}, {mapPinnedDest.lng.toFixed(3)}
                  </div>
                )}
                {routeResult && (
                  <div className="map-chip" style={{ borderColor: 'rgba(0,212,255,0.4)', color: 'var(--brand-primary)' }}>
                    ✦ GA Optimal Route Drawn
                  </div>
                )}
              </div>

              <FleetMap
                drones={drones}
                hub={hub}
                routeResult={routeResult}
                selectedDroneId={selectedDroneId}
                onDroneSelect={setSelectedDroneId}
                onMapClick={(coords) => setMapPinnedDest(coords)}
                customDestination={mapPinnedDest}
                sidebarState={`${isDrawerOpen}-${isNavCollapsed}`}
              />

              {/* Map Legend */}
              <div className="map-legend">
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '1px', marginBottom: 8, textTransform: 'uppercase' }}>
                  Mumbai Air Corridors
                </div>
                {[
                  { color: '#00d4ff',  label: 'GA Optimised Flight Path',  type: 'line' },
                  { color: '#06ffa5',  label: 'Safe Landing Approach',     type: 'line' },
                  { color: '#ff3d57',  label: 'Mumbai No-Fly Zone (NFZ)',  type: 'dash' },
                  { color: '#06ffa5',  label: 'Active Delivery Drone',     type: 'dot'  },
                  { color: '#fbbf24',  label: 'Caution / RTB Warning',     type: 'dot'  },
                  { color: '#ff3d57',  label: 'Emergency / Depleted',      type: 'dot'  },
                  { color: '#00d4ff',  label: 'BKC Central Hub',           type: 'dot'  },
                ].map(item => (
                  <div key={item.label} className="legend-item">
                    {item.type === 'line' && (
                      <div className="legend-line" style={{ background: item.color }} />
                    )}
                    {item.type === 'dash' && (
                      <div className="legend-line" style={{
                        background: 'none',
                        border: `2px dashed ${item.color}`,
                        height: 0,
                        borderRadius: 0,
                      }} />
                    )}
                    {item.type === 'dot' && (
                      <div className="legend-circle" style={{ background: item.color }} />
                    )}
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT PANEL: Live Telemetry Stream Only ── */}
            <div className="sidebar right-panel" style={{ flexShrink: 0 }}>
              <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(8,15,31,0.9)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--brand-primary)',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                flexShrink: 0,
              }}>
                <Radio size={12} />
                <span>Live Telemetry Stream</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <TelemetryHUD
                  drones={drones}
                  selectedDroneId={selectedDroneId}
                  onDroneSelect={setSelectedDroneId}
                />
              </div>
            </div>
          </div>
        )}

        {/* View 3: Dedicated Live Missions Tracking & Delivery Logbook Hub */}
        {(currentView === 'missions' || currentView === 'predictions') && (
          <MissionsDeliveriesPage
            onGoToDispatch={() => {
              setCurrentView('dashboard');
              setActiveNav('dispatch');
              setIsDrawerOpen(true);
            }}
          />
        )}
      </div>

      {/* Global Toast System */}
      <ToastContainer />
    </>
  );
}
