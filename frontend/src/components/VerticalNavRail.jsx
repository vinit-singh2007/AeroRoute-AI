// AeroRoute — Vertical Navigation Sidebar (Inspired by Modern Glassmorphic Rail)
import { useState } from 'react';
import {
  Send,
  Layers,
  Cpu,
  Shield,
  Home,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Radio,
  Sliders,
  Settings,
  Package
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
}) {
  return (
    <aside style={{
      width: isCollapsed ? 68 : 210,
      minWidth: isCollapsed ? 68 : 210,
      maxWidth: isCollapsed ? 68 : 210,
      height: '100%',
      background: 'rgba(8, 16, 33, 0.92)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(0, 212, 255, 0.12)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: isCollapsed ? '16px 8px' : '16px 12px',
      boxSizing: 'border-box',
      transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1), min-width 220ms, max-width 220ms',
      zIndex: 20,
      userSelect: 'none',
      position: 'relative',
      overflowX: 'hidden',
    }}>

      {/* ── TOP SECTION: Hub Profile Card & Menu ── */}
      <div>

        {/* Profile / Hub Card (Styled like reference image) */}
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
        title="BKC Central Logistics Hub"
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
                BKC Logistics Hub
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
          {isCollapsed ? '•••' : 'MENU'}
        </div>

        {/* ── VERTICAL NAV ITEMS ── */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            {
              id: 'dispatch',
              label: 'Dispatch Mission',
              icon: <Send size={16} />,
              badge: null,
            },
            {
              id: 'missions',
              label: 'Live Deliveries',
              icon: <Package size={16} />,
              badge: 'LIVE',
              isView: true,
            },
            {
              id: 'fleet',
              label: 'Fleet Management',
              icon: <Layers size={16} />,
              badge: dronesCount,
            },
            {
              id: 'safety',
              label: 'Flight Safety',
              icon: <Shield size={16} />,
              badge: null,
            },
          ].map(item => {
            const isActive = item.isView
              ? currentView === 'missions'
              : (currentView === 'dashboard' && activeItem === item.id && isDrawerOpen);

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.isView) {
                    onNavigateView('missions');
                  } else {
                    if (currentView !== 'dashboard') {
                      onNavigateView('dashboard');
                    }
                    onSelectItem(item.id);
                  }
                }}
                id={`nav-item-${item.id}`}
                title={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: isCollapsed ? '10px 0' : '10px 12px',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  borderRadius: 10,
                  border: isActive ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid transparent',
                  background: isActive
                    ? 'linear-gradient(90deg, rgba(0, 212, 255, 0.16) 0%, rgba(0, 212, 255, 0.04) 100%)'
                    : 'transparent',
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 160ms ease',
                  position: 'relative',
                  outline: 'none',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {/* Active Indicator Glow Pill on Far Left */}
                {isActive && (
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
                  color: isActive ? 'var(--brand-primary)' : 'inherit',
                  filter: isActive ? 'drop-shadow(0 0 6px rgba(0,212,255,0.6))' : 'none',
                }}>
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <span style={{
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
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
                    background: isActive ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.08)',
                    color: isActive ? 'var(--brand-primary)' : 'var(--text-muted)',
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
          })}
        </nav>

        {/* ── DIVIDER ── */}
        <div style={{
          height: 1,
          background: 'rgba(255, 255, 255, 0.08)',
          margin: '16px 4px',
        }} />

        {/* ── SECONDARY CATEGORY: VIEWS ── */}
        <div style={{
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: '1.5px',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          padding: isCollapsed ? '0 0 8px 0' : '0 8px 8px 8px',
          textAlign: isCollapsed ? 'center' : 'left',
        }}>
          {isCollapsed ? '•••' : 'VIEWS'}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Landing / Overview */}
          <button
            onClick={() => onNavigateView('landing')}
            id="nav-item-landing"
            title="Overview Landing Page"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: isCollapsed ? '10px 0' : '10px 12px',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              borderRadius: 10,
              border: currentView === 'landing' ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid transparent',
              background: currentView === 'landing' ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
              color: currentView === 'landing' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 160ms ease',
            }}
          >
            <Home size={16} />
            {!isCollapsed && (
              <span style={{ fontSize: 12, fontWeight: currentView === 'landing' ? 700 : 500 }}>
                Overview Page
              </span>
            )}
          </button>

          {/* Fleet Map Ops */}
          <button
            onClick={() => onNavigateView('dashboard')}
            id="nav-item-dashboard"
            title="Live Fleet Map Operations"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: isCollapsed ? '10px 0' : '10px 12px',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              borderRadius: 10,
              border: currentView === 'dashboard' ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid transparent',
              background: currentView === 'dashboard' ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
              color: currentView === 'dashboard' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 160ms ease',
            }}
          >
            <Radio size={16} />
            {!isCollapsed && (
              <span style={{ fontSize: 12, fontWeight: currentView === 'dashboard' ? 700 : 500 }}>
                Fleet Map Ops
              </span>
            )}
          </button>

          {/* Deliveries & Missions Hub */}
          <button
            onClick={() => onNavigateView('missions')}
            id="nav-item-missions-hub"
            title="Missions & Delivery Logs Hub"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: isCollapsed ? '10px 0' : '10px 12px',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              borderRadius: 10,
              border: currentView === 'missions' ? '1px solid rgba(6, 255, 165, 0.4)' : '1px solid transparent',
              background: currentView === 'missions' ? 'rgba(6, 255, 165, 0.12)' : 'transparent',
              color: currentView === 'missions' ? 'var(--brand-accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 160ms ease',
            }}
          >
            <Package size={16} />
            {!isCollapsed && (
              <span style={{ fontSize: 12, fontWeight: currentView === 'missions' ? 700 : 500 }}>
                Deliveries Hub
              </span>
            )}
          </button>
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
