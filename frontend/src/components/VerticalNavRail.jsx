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
