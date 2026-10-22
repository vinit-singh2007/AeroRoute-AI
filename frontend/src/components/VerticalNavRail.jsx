// AeroRoute — Vertical Navigation Sidebar (Inspired by Modern Glassmorphic Rail)
import { useState } from 'react';
import {
  Radio,
  Send,
  Navigation,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Map,
  Activity
} from 'lucide-react';

export default function VerticalNavRail({
  activeItem,
  onSelectItem,
  isDrawerOpen,
  onToggleDrawer,
  isCollapsed,
  onToggleCollapse,
  onNavigateView,
  currentView,
  dronesCount = 3,
  isTelemetryCollapsed = false,
  onExpandTelemetry,
  isManualRedEmergency = false,
  onToggleManualEmergency,
}) {
  return (
    <aside style={{
      width: isCollapsed ? 68 : 220,
      minWidth: isCollapsed ? 68 : 220,
      maxWidth: isCollapsed ? 68 : 220,
      height: '100vh',
      minHeight: '100vh',
      maxHeight: '100vh',
      alignSelf: 'stretch',
      background: 'rgba(8, 16, 33, 0.94)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(0, 212, 255, 0.15)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: isCollapsed ? '16px 8px' : '18px 12px',
      boxSizing: 'border-box',
      transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1), min-width 220ms, max-width 220ms',
      zIndex: 20,
      userSelect: 'none',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: 'auto',
      flexShrink: 0,
      borderRadius: 0,
    }}>

      {/* ── TOP SECTION: Hub Profile Card & Menu ── */}
      <div>

        {/* Profile / Hub Card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: isCollapsed ? '8px 4px' : '10px 10px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 10,
          marginBottom: 20,
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          cursor: 'pointer',
        }}
          title="MMR Central Logistics Hub (Midway)"
        >
          {/* Avatar icon */}
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #00d4ff, #0a2540)',
            border: '1.5px solid rgba(0, 212, 255, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            flexShrink: 0,
            boxShadow: '0 0 10px rgba(0,212,255,0.3)',
          }}>
            📍
          </div>

          {!isCollapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                MMR Logistics Hub (Midway)
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--brand-accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--brand-accent)', display: 'inline-block' }} />
                Online Base
              </div>
            </div>
          )}

          {!isCollapsed && (
            <ChevronDown size={12} color="var(--text-muted)" />
          )}
        </div>

        {/* ── MENU CATEGORY HEADER ── */}
        <div style={{
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: '1.5px',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          padding: isCollapsed ? '0 0 8px 0' : '0 8px 8px 8px',
          textAlign: isCollapsed ? 'center' : 'left',
        }}>
          {isCollapsed ? '•••' : 'NAVIGATION'}
        </div>

        {/* ── VERTICAL NAV ITEMS (4 ITEMS) ── */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            {
              id: 'overview',
              label: 'Overview',
              tooltip: 'Overview — Map & Live Telemetry',
              icon: <Radio size={16} />,
              badge: null,
              isActive: currentView === 'dashboard',
              onClick: () => {
                onNavigateView('dashboard');
                onSelectItem('overview');
              },
            },
            {
              id: 'dispatch',
              label: 'Dispatch Delivery',
              tooltip: 'Dispatch Delivery Mission Center',
              icon: <Send size={16} />,
              isActive: currentView === 'dispatch',
              onClick: () => onNavigateView('dispatch'),
            },
            {
              id: 'live-drones',
              label: 'Live Drones',
              tooltip: 'Live Assigned & Delivering Drones Fleet',
              icon: <Navigation size={16} />,
              badge: `${dronesCount}`,
              isActive: currentView === 'live-drones',
              onClick: () => onNavigateView('live-drones'),
            },
            {
              id: 'missions',
              label: 'Delivery Logs',
              tooltip: 'Missions & Delivery Records Hub',
              icon: <Package size={16} />,
              badge: null,
              isActive: currentView === 'missions',
              onClick: () => onNavigateView('missions'),
            },
          ].map(item => (
            <NavItem key={item.id} item={item} isCollapsed={isCollapsed} />
          ))}
        </nav>

        {/* ── DIVIDER ── */}
        <div style={{
          margin: '14px 4px 10px',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.25), transparent)',
        }} />

        {/* ── SECONDARY NAV: Fleet Map & Live Telemetry ── */}
        {!isCollapsed && (
          <div style={{
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: '1.5px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            padding: '0 8px 8px 8px',
          }}>
            FLEET OPS
          </div>
        )}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            {
              id: 'fleet-map',
              label: 'Fleet Map',
              tooltip: 'Fleet Map — Live Mumbai Air Corridors',
              icon: <Map size={16} />,
              isActive: currentView === 'dashboard',
              onClick: () => {
                onNavigateView('dashboard');
                onSelectItem('overview');
              },
            },
            {
              id: 'live-telemetry',
              label: 'Live Telemetry',
              tooltip: 'Live Telemetry Stream HUD',
              icon: <Activity size={16} />,
              // Active ONLY when on dashboard AND telemetry panel is expanded
              isActive: currentView === 'dashboard' && !isTelemetryCollapsed,
              // When sidebar is collapsed, hide the active pointer for this item
              hidePointerWhenCollapsed: true,
              onClick: () => {
                onNavigateView('dashboard');
                onSelectItem('overview');
                onExpandTelemetry?.();
              },
            },
          ].map(item => (
            <NavItem
              key={item.id}
              item={item}
              isCollapsed={isCollapsed}
              hidePointer={isCollapsed && item.hidePointerWhenCollapsed}
            />
          ))}
        </nav>
      </div>

      {/* ── SIMULATION / PRESENTATION TOGGLE (Below Fleet Ops, Above Collapse Sidebar) ── */}
      <div style={{
        marginTop: 'auto',
        marginBottom: 10,
        paddingTop: 10,
      }}>
        {!isCollapsed ? (
          <div style={{
            padding: '10px 10px',
            borderRadius: 10,
            background: isManualRedEmergency
              ? 'radial-gradient(circle at 50% 0%, rgba(255, 61, 87, 0.22) 0%, rgba(20, 8, 14, 0.95) 100%)'
              : 'rgba(255, 255, 255, 0.03)',
            border: isManualRedEmergency
              ? '1.5px solid rgba(255, 61, 87, 0.65)'
              : '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: isManualRedEmergency
              ? '0 0 18px rgba(255, 61, 87, 0.3), inset 0 0 10px rgba(255, 61, 87, 0.15)'
              : 'none',
            transition: 'all 200ms ease',
          }}>
            {/* Header / Mode Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <span style={{
                fontSize: 9.5,
                fontWeight: 800,
                letterSpacing: '1.2px',
                color: isManualRedEmergency ? '#ff7283' : 'var(--text-muted)',
                textTransform: 'uppercase',
              }}>
                TELEMETRY MODE
              </span>
              <span style={{
                fontSize: 9,
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 12,
                background: isManualRedEmergency ? 'rgba(255, 61, 87, 0.25)' : 'rgba(6, 255, 165, 0.15)',
                color: isManualRedEmergency ? '#ff3d57' : '#06ffa5',
                border: `1px solid ${isManualRedEmergency ? 'rgba(255, 61, 87, 0.5)' : 'rgba(6, 255, 165, 0.4)'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: isManualRedEmergency ? '#ff3d57' : '#06ffa5',
                  boxShadow: isManualRedEmergency ? '0 0 6px #ff3d57' : '0 0 6px #06ffa5',
                }} />
                {isManualRedEmergency ? 'EMERGENCY' : 'LIVE'}
              </span>
            </div>

            {/* 2-Way Interactive Segmented Switch */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 4,
              background: 'rgba(0, 0, 0, 0.45)',
              padding: 3,
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              {/* Option 1: Live (Normal working mode) */}
              <button
                type="button"
                id="toggle-live-mode-btn"
                onClick={() => onToggleManualEmergency?.(false)}
                title="Switch to Real Live Telemetry"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '6px 4px',
                  borderRadius: 6,
                  border: !isManualRedEmergency ? '1px solid rgba(6, 255, 165, 0.4)' : '1px solid transparent',
                  background: !isManualRedEmergency ? 'rgba(6, 255, 165, 0.16)' : 'transparent',
                  color: !isManualRedEmergency ? '#06ffa5' : 'var(--text-muted)',
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  fontFamily: 'inherit',
                }}
              >
                <span>Live</span>
              </button>

              {/* Option 2: Manual Red Emergency (Presentation Mode) */}
              <button
                type="button"
                id="toggle-red-emergency-btn"
                onClick={() => onToggleManualEmergency?.(true)}
                title="Simulate Red Emergency State (Frontend presentation only)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '6px 4px',
                  borderRadius: 6,
                  border: isManualRedEmergency ? '1px solid rgba(255, 61, 87, 0.7)' : '1px solid transparent',
                  background: isManualRedEmergency ? 'rgba(255, 61, 87, 0.28)' : 'transparent',
                  color: isManualRedEmergency ? '#ff3d57' : 'var(--text-muted)',
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  fontFamily: 'inherit',
                  boxShadow: isManualRedEmergency ? '0 0 10px rgba(255, 61, 87, 0.35)' : 'none',
                }}
              >
                <span>🚨 Red Alert</span>
              </button>
            </div>

            {/* Explainer caption */}
            <div style={{
              marginTop: 6,
              fontSize: 9,
              color: isManualRedEmergency ? '#ff9ca7' : 'var(--text-muted)',
              textAlign: 'center',
              lineHeight: 1.25,
            }}>
              {isManualRedEmergency ? '⚠ Presentation Simulation Active' : 'Normal Live Stream'}
            </div>
          </div>
        ) : (
          /* Collapsed Sidebar Compact Button */
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
            <button
              type="button"
              id="toggle-mode-collapsed-btn"
              onClick={() => onToggleManualEmergency?.(!isManualRedEmergency)}
              title={isManualRedEmergency ? '🚨 Red Emergency Active (Click to switch to Live)' : '🟢 Live Mode (Click to simulate Red Emergency)'}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: isManualRedEmergency ? '1.5px solid rgba(255, 61, 87, 0.8)' : '1px solid rgba(6, 255, 165, 0.4)',
                background: isManualRedEmergency ? 'rgba(255, 61, 87, 0.25)' : 'rgba(6, 255, 165, 0.1)',
                boxShadow: isManualRedEmergency ? '0 0 14px rgba(255, 61, 87, 0.45)' : 'none',
                transition: 'all 180ms ease',
                padding: 0,
              }}
            >
              <span style={{ fontSize: 14 }}>{isManualRedEmergency ? '🚨' : '🟢'}</span>
              <span style={{
                fontSize: 8,
                fontWeight: 900,
                marginTop: 2,
                color: isManualRedEmergency ? '#ff3d57' : '#06ffa5',
                letterSpacing: '0.4px',
              }}>
                {isManualRedEmergency ? 'ALERT' : 'LIVE'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ── BOTTOM SECTION: Collapse / Expand Rail Toggle ── */}
      <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: isCollapsed ? '8px 0' : '8px 10px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255, 255, 255, 0.03)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 11,
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--brand-primary)';
            e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
          }}
        >
          {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          {!isCollapsed && <span>Collapse Sidebar</span>}
        </button>
      </div>

    </aside>
  );
}

// ── Reusable Nav Item Button ──
function NavItem({ item, isCollapsed, hidePointer = false }) {
  return (
    <button
      onClick={item.onClick}
      id={`nav-item-${item.id}`}
      title={item.tooltip || item.label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: isCollapsed ? '10px 0' : '10px 12px',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        borderRadius: 10,
        border: item.isActive ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid transparent',
        background: item.isActive
          ? 'linear-gradient(90deg, rgba(0, 212, 255, 0.16) 0%, rgba(0, 212, 255, 0.04) 100%)'
          : 'transparent',
        color: item.isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 160ms ease',
        position: 'relative',
        outline: 'none',
      }}
      onMouseEnter={e => {
        if (!item.isActive) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          e.currentTarget.style.color = '#fff';
        }
      }}
      onMouseLeave={e => {
        if (!item.isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {/* Active Indicator Glow Pill — hidden when hidePointer is true */}
      {item.isActive && !hidePointer && (
        <span style={{
          position: 'absolute',
          left: 0,
          top: '20%',
          bottom: '20%',
          width: 3.5,
          borderRadius: '0 4px 4px 0',
          background: 'var(--brand-primary)',
          boxShadow: '0 0 10px var(--brand-primary)',
        }} />
      )}

      <span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: item.isActive ? 'var(--brand-primary)' : 'inherit',
        filter: item.isActive ? 'drop-shadow(0 0 6px rgba(0,212,255,0.6))' : 'none',
      }}>
        {item.icon}
      </span>

      {!isCollapsed && (
        <span style={{
          fontSize: 12,
          fontWeight: item.isActive ? 700 : 500,
          letterSpacing: '0.2px',
          flex: 1,
          textAlign: 'left',
          whiteSpace: 'nowrap',
        }}>
          {item.label}
        </span>
      )}

      {/* Badge if present */}
      {!isCollapsed && item.badge && (
        <span style={{
          fontSize: 9.5,
          fontWeight: 800,
          padding: '2px 6px',
          borderRadius: 10,
          background: item.isActive ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.08)',
          color: item.isActive ? 'var(--brand-primary)' : 'var(--text-muted)',
        }}>
          {item.badge}
        </span>
      )}

      {/* Collapsed dot for badge */}
      {isCollapsed && item.badge && (
        <span style={{
          position: 'absolute',
          top: 6,
          right: 8,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--brand-primary)',
          boxShadow: '0 0 6px var(--brand-primary)',
        }} />
      )}
    </button>
  );
}
