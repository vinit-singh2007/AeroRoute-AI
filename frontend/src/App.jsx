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
  Database,
  Send,
  Package,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import FleetMap          from './components/FleetMap';
import DispatchPanel     from './components/DispatchPanel';
import MissionDispatchPage from './components/MissionDispatchPage';
import TelemetryHUD      from './components/TelemetryHUD';
import FleetOverview     from './components/FleetOverview';
import EmergencyControls from './components/EmergencyControls';
import LandingPage       from './components/LandingPage';
import MissionsDeliveriesPage from './components/MissionsDeliveriesPage';
import PredictionsPanel  from './components/PredictionsPanel';
import LiveDronesPage    from './components/LiveDronesPage';
import VerticalNavRail   from './components/VerticalNavRail';
import CesiumDroneTracker from './components/CesiumDroneTracker';
import { ToastContainer } from './components/Toast';
import { useTelemetry }  from './hooks/useTelemetry';
import { getDatabaseStatus } from './services/api';



function NavBar({ lastUpdate, currentView, onViewChange }) {
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString('en-IN', { hour12: false })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeDisplay = lastUpdate
    ? lastUpdate.toLocaleTimeString('en-IN', { hour12: false })
    : currentTime;

  return (
    <nav className="top-nav">
      <div className="nav-logo" style={{ cursor: 'pointer' }} onClick={() => onViewChange('landing')}>
        <div className="nav-logo-icon">✈️</div>
        <div>
          <div className="nav-logo-text">AeroRoute</div>
          <div className="nav-logo-sub">Mumbai Drone Dispatch Platform</div>
        </div>
      </div>

      {/* Main Navigation Tab: Live Fleet Map & Telemetry */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => onViewChange('dashboard')}
          className={`btn btn-sm ${currentView === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`}
          style={{
            fontSize: 11,
            fontWeight: currentView === 'dashboard' ? 800 : 500,
            padding: '5px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: 6,
          }}
          id="nav-tab-dashboard"
        >
          <Radio size={12} /> Live Fleet Map & Telemetry
        </button>
      </div>

      {/* Right Side: Only Time Stamp */}
      <div className="nav-status-bar">
        <div className="nav-status-item">
          <Clock size={12} />
          <span className="text-mono">{timeDisplay}</span>
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
  const [activeNav,            setActiveNav]            = useState('overview');
  const [isDrawerOpen,         setIsDrawerOpen]         = useState(false);
  const [isNavCollapsed,       setIsNavCollapsed]       = useState(false);
  const [mapTheme,             setMapTheme]             = useState('street');
  const [isTelemetryCollapsed, setIsTelemetryCollapsed] = useState(false);
  const [dbStatus,             setDbStatus]             = useState(null);
  const [tracked3DDroneId,     setTracked3DDroneId]     = useState(null);

  const tracked3DDrone = useMemo(() => {
    if (!tracked3DDroneId) return null;
    const found = drones.find(d => d.id === tracked3DDroneId);
    if (found) return found;
    return {
      id: tracked3DDroneId,
      model: 'Phantom-Mumbai X7',
      status: 'RTB',
      lat: 19.223,
      lng: 72.848,
      altitude_m: 86,
      speed_kmh: 62,
      battery_pct: 5,
      max_payload_kg: 4.0,
    };
  }, [drones, tracked3DDroneId]);

  // Navigate helper with URL synchronization
  const navigateView = (view) => {
    setCurrentView(view);
    const path = view === 'landing' ? '/' : view === 'dispatch' ? '/mission-dispatch' : view === 'live-drones' ? '/live-drones' : `/${view}`;
    try {
      if (window.location.pathname !== path) {
        window.history.pushState(null, '', path);
      }
    } catch {
      // Ignore in iframe/sandbox environments
    }
  };

  // Sync route on mount and browser back/forward navigation
  useEffect(() => {
    const syncRouteFromUrl = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (path.includes('mission-dispatch') || hash.includes('dispatch')) {
        setCurrentView('dispatch');
      } else if (path.includes('live-drones') || hash.includes('live-drones') || hash.includes('drones')) {
        setCurrentView('live-drones');
      } else if (path.includes('missions') || hash.includes('missions')) {
        setCurrentView('missions');
      } else if (path.includes('dashboard') || hash.includes('dashboard')) {
        setCurrentView('dashboard');
      }
    };
    syncRouteFromUrl();
    window.addEventListener('popstate', syncRouteFromUrl);
    window.addEventListener('hashchange', syncRouteFromUrl);
    return () => {
      window.removeEventListener('popstate', syncRouteFromUrl);
      window.removeEventListener('hashchange', syncRouteFromUrl);
    };
  }, []);

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
        {/* Navigation Bar — Only on Landing Page */}
        {currentView === 'landing' && (
          <NavBar
            connected={connected}
            lastUpdate={lastUpdate}
            dronesCount={drones.length}
            dbStatus={dbStatus}
            currentView={currentView}
            onViewChange={navigateView}
          />
        )}

        {/* View 1: Landing Page */}
        {currentView === 'landing' ? (
          <LandingPage
            onLaunchDashboard={() => navigateView('dashboard')}
            onOpenPredictions={() => navigateView('missions')}
            onOpenMissions={() => navigateView('missions')}
            activeDronesCount={drones.length}
          />
        ) : (
          <div className="main-content" style={{ display: 'flex', flex: 1, height: '100vh', overflow: 'hidden' }}>
            {/* ── FAR LEFT: Persistent Vertical Navigation Sidebar across ALL Pages ── */}
            <VerticalNavRail
              activeItem={activeNav}
              onSelectItem={(item) => {
                if (item === 'overview') {
                  setIsDrawerOpen(false);
                  setActiveNav('overview');
                  return;
                }
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
              onNavigateView={navigateView}
              currentView={currentView}
              dronesCount={drones.length}
            />

            {/* ── RIGHT VIEWPORT: Active View Page (Flex 1) ── */}
            <div style={{ flex: 1, height: '100vh', minHeight: '100vh', maxHeight: '100vh', overflow: 'hidden', display: 'flex', position: 'relative' }}>
              {/* View 2: Mission Control Dashboard (Overview) */}
              {currentView === 'dashboard' && (
                <>
                  {/* ── CENTER PANEL: Mumbai Interactive Map ── */}
                  <div className="map-area">
              <div className="map-overlay-top" style={{
                position: 'absolute',
                top: 14,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                pointerEvents: 'all',
                maxWidth: '92%',
                flexWrap: 'nowrap',
              }}>
                {/* Map Theme Mode Switcher — Order: Street -> Tactical Dark -> Satellite */}
                <div style={{
                  display: 'flex',
                  gap: 3,
                  background: 'rgba(5, 12, 24, 0.9)',
                  padding: '3px 4px',
                  borderRadius: 20,
                  border: '1px solid var(--border-subtle)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                }}>
                  {[
                    { id: 'street', label: 'Street', icon: '🏙️' },
                    { id: 'dark', label: 'Tactical Dark', icon: '🗺️' },
                    { id: 'satellite', label: 'Satellite', icon: '🛰️' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setMapTheme(t.id)}
                      id={`theme-btn-${t.id}`}
                      style={{
                        background: mapTheme === t.id ? 'rgba(0, 212, 255, 0.22)' : 'transparent',
                        border: mapTheme === t.id ? '1px solid rgba(0, 212, 255, 0.55)' : '1px solid transparent',
                        color: mapTheme === t.id ? 'var(--brand-primary)' : 'var(--text-secondary)',
                        borderRadius: 16,
                        padding: '3px 9px',
                        fontSize: 10.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 120ms ease',
                        outline: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>

                {/* Mumbai Fleet Active — Placed after themes */}
                <div className="map-chip">
                  <div className="pulse-dot" />
                  Mumbai Fleet Active ({drones.length})
                </div>

                {mapPinnedDest && typeof mapPinnedDest.lat === 'number' && typeof mapPinnedDest.lng === 'number' && (
                  <div className="map-chip" style={{ borderColor: 'rgba(6,255,165,0.4)', color: 'var(--brand-accent)' }}>
                    🎯 Target: {mapPinnedDest.lat.toFixed(3)}, {mapPinnedDest.lng.toFixed(3)}
                  </div>
                )}
                {routeResult && (
                  <div className="map-chip" style={{ borderColor: 'rgba(0,212,255,0.4)', color: 'var(--brand-primary)' }}>
                    ✦ GA Optimal Route
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
                sidebarState={`${isNavCollapsed}-${isTelemetryCollapsed}`}
                mapTheme={mapTheme}
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

            {/* ── RIGHT PANEL: Live Telemetry Rail (Collapsed Strip or Expanded HUD) ── */}
            <div className="sidebar right-panel" style={{
              flexShrink: 0,
              height: '100vh',
              minHeight: '100vh',
              maxHeight: '100vh',
              borderRadius: 0,
              width: isTelemetryCollapsed ? 68 : 350,
              minWidth: isTelemetryCollapsed ? 68 : 350,
              maxWidth: isTelemetryCollapsed ? 68 : 350,
              borderLeft: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              transition: 'width 240ms cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(8, 15, 31, 0.95)',
              zIndex: 300,
            }}>
              {isTelemetryCollapsed ? (
                /* ── COLLAPSED VERTICAL STRIP: Drones BOM-1, BOM-2, BOM-3 with Condition Signs ── */
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  userSelect: 'none',
                }}>
                  {/* Top Expand Button */}
                  <button
                    onClick={() => setIsTelemetryCollapsed(false)}
                    id="expand-telemetry-btn"
                    title="Expand Live Telemetry HUD"
                    style={{
                      width: '100%',
                      padding: '12px 0 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0, 212, 255, 0.06)',
                      border: 'none',
                      borderBottom: '1px solid var(--border-subtle)',
                      color: 'var(--brand-primary)',
                      cursor: 'pointer',
                      gap: 4,
                      transition: 'all 150ms ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(0, 212, 255, 0.16)';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(0, 212, 255, 0.06)';
                      e.currentTarget.style.color = 'var(--brand-primary)';
                    }}
                  >
                    <ChevronLeft size={16} />
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                      EXPAND
                    </span>
                  </button>

                  {/* Strip Label */}
                  <div style={{
                    padding: '8px 4px 4px',
                    textAlign: 'center',
                    fontSize: 9,
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}>
                    FLEET
                  </div>

                  {/* Vertical Drones List */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}>
                    {drones.map(d => {
                      const isSelected = d.id === selectedDroneId;
                      const shortName = d.id.replace('BOM-00', 'BOM-').replace('BOM-0', 'BOM-');
                      
                      // Condition: Red = RTB/Critical, Yellow = Caution, Green = Safe/Optimal
                      const isRed = d.status === 'RTB' || d.battery_pct < 20 || (typeof d.fsi === 'number' && d.fsi < 35);
                      const isYellow = !isRed && (d.battery_pct < 50 || (typeof d.fsi === 'number' && d.fsi < 65) || d.action_status === 'REROUTE_RECOMMENDED');
                      const statusColor = isRed ? '#ff3d57' : isYellow ? '#fbbf24' : '#06ffa5';
                      const statusTitle = isRed ? 'Condition: Critical / RTB' : isYellow ? 'Condition: Caution' : 'Condition: Optimal / Safe';

                      return (
                        <div
                          key={d.id}
                          onClick={() => setSelectedDroneId(d.id)}
                          onDoubleClick={() => {
                            setSelectedDroneId(d.id);
                            setIsTelemetryCollapsed(false);
                          }}
                          id={`strip-drone-${d.id}`}
                          title={`${shortName} (${d.status || 'Active'}) — ${statusTitle}\nBattery: ${Math.round(d.battery_pct)}%\nClick to select | Double-click to expand`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px 4px 8px',
                            borderRadius: 8,
                            background: isSelected ? 'rgba(0, 212, 255, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                            border: isSelected ? '1px solid var(--brand-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                            cursor: 'pointer',
                            transition: 'all 150ms ease',
                            position: 'relative',
                            boxShadow: isSelected ? '0 0 12px rgba(0, 212, 255, 0.25)' : 'none',
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                              e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.35)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                            }
                          }}
                        >
                          {/* Condition Indicator Sign (Green / Yellow / Red glowing dot) */}
                          <div style={{ position: 'relative', marginBottom: 5 }}>
                            <div style={{
                              width: 9,
                              height: 9,
                              borderRadius: '50%',
                              background: statusColor,
                              boxShadow: `0 0 8px ${statusColor}`,
                            }} />
                          </div>

                          {/* Drone Name e.g. BOM-1 */}
                          <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)',
                            fontFamily: 'JetBrains Mono, monospace',
                            letterSpacing: '0.3px',
                            lineHeight: 1.1,
                          }}>
                            {shortName}
                          </span>

                          {/* Battery percentage */}
                          <span style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: statusColor,
                            fontFamily: 'JetBrains Mono, monospace',
                            marginTop: 4,
                          }}>
                            {Math.round(d.battery_pct)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Strip Toggle Button */}
                  <button
                    onClick={() => setIsTelemetryCollapsed(false)}
                    title="Expand Live Telemetry"
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      border: 'none',
                      borderTop: '1px solid var(--border-subtle)',
                      background: 'rgba(8,15,31,0.95)',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                      cursor: 'pointer',
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.6px',
                      transition: 'all 140ms ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = 'var(--brand-primary)';
                      e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.background = 'rgba(8,15,31,0.95)';
                    }}
                  >
                    <Radio size={13} color="var(--brand-primary)" />
                    <span>HUD</span>
                  </button>
                </div>
              ) : (
                /* ── FULL EXPANDED TELEMETRY HUD (Identical to original with zero layout changes) ── */
                <>
                  <div style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'rgba(8,15,31,0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 10,
                    fontWeight: 800,
                    color: 'var(--brand-primary)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Radio size={12} />
                      <span>Live Telemetry Stream</span>
                    </div>
                    <button
                      onClick={() => setIsTelemetryCollapsed(true)}
                      id="collapse-telemetry-btn"
                      title="Collapse to Sidebar Strip"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 6,
                        padding: '3px 8px',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10,
                        transition: 'all 120ms ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = 'var(--brand-primary)';
                        e.currentTarget.style.borderColor = 'rgba(0,212,255,0.4)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      }}
                    >
                      <span>Collapse</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <TelemetryHUD
                      drones={drones}
                      selectedDroneId={selectedDroneId}
                      onDroneSelect={setSelectedDroneId}
                    />
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* View 3: Dedicated Full-Page Mission Dispatch Command Center */}
        {currentView === 'dispatch' && (
          <MissionDispatchPage
            drones={drones}
            hub={hub}
            onRouteResult={setRouteResult}
            onNavigateToDashboard={() => navigateView('dashboard')}
            onNavigateToMissions={() => navigateView('missions')}
            onRefreshFleet={resetFleet}
          />
        )}

        {/* View 4: Dedicated Live Fleet Drones Page */}
        {currentView === 'live-drones' && (
          <LiveDronesPage
            drones={drones}
            onTrackOnMap={(droneId) => {
              setSelectedDroneId(droneId);
              setTracked3DDroneId(droneId);
            }}
            onGoToDispatch={() => navigateView('dispatch')}
            onRefreshFleet={resetFleet}
          />
        )}

        {/* View 5: Dedicated Live Missions Tracking & Delivery Logbook Hub */}
        {(currentView === 'missions' || currentView === 'predictions') && (
          <MissionsDeliveriesPage
            onGoToDispatch={() => navigateView('dispatch')}
          />
        )}
            </div>
          </div>
        )}
      </div>

      {/* ── DEDICATED 3D DRONE TRACKING VIEWPORT (CesiumJS + Google Photorealistic 3D Tiles) ── */}
      {tracked3DDrone && (
        <CesiumDroneTracker
          drone={tracked3DDrone}
          onClose={() => setTracked3DDroneId(null)}
          allDrones={drones}
          onSelectDrone={(droneId) => {
            setSelectedDroneId(droneId);
            setTracked3DDroneId(droneId);
          }}
        />
      )}

      {/* Global Toast System */}
      <ToastContainer />
    </>
  );
}
