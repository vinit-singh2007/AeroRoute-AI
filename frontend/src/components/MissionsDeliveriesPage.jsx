// AeroRoute — Dedicated Live Missions & Delivered Orders Hub
import { useState, useEffect } from 'react';
import {
  Package,
  Send,
  CheckCircle2,
  Clock,
  Navigation,
  Radio,
  Zap,
  Shield,
  ArrowRight,
  TrendingUp,
  MapPin,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { getMissions } from '../services/api';

export default function MissionsDeliveriesPage({ onGoToDispatch }) {
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'delivered'
  const [missionsData, setMissionsData] = useState({
    active_missions: [],
    delivered_missions: [],
    stats: {
      total_dispatched: 3,
      currently_active: 0,
      delivered_count: 3,
      success_rate: 100.0,
    }
  });
  const [loading, setLoading] = useState(false);

  const fetchMissions = async () => {
    try {
      const data = await getMissions();
      if (data) {
        setMissionsData(data);
      }
    } catch (err) {
      console.error('Failed to fetch missions:', err);
    }
  };

  useEffect(() => {
    fetchMissions();
    const interval = setInterval(fetchMissions, 2000);
    return () => clearInterval(interval);
  }, []);

  const stats = missionsData.stats || {
    total_dispatched: 0,
    currently_active: 0,
    delivered_count: 0,
    success_rate: 100.0,
  };

  return (
    <div style={{
      height: '100%',
      maxHeight: '100%',
      width: '100%',
      flex: 1,
      overflowY: 'auto',
      padding: '24px 32px',
      boxSizing: 'border-box',
    }}>

      {/* Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(6,255,165,0.2))',
              border: '1px solid rgba(0,212,255,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}>
              📦
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: 0 }}>
              Live Missions & Delivery Logs
            </h1>
            <span className="status-chip DELIVERING" style={{ fontSize: 10 }}>
              Live Fleet Stream
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Real-time tracking of assigned drone missions, flight telemetry, and verified delivery history across Mumbai.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={fetchMissions}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={12} /> Refresh
          </button>

          {onGoToDispatch && (
            <button
              className="btn btn-primary"
              onClick={onGoToDispatch}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                fontSize: 12,
                fontWeight: 800,
                borderRadius: 8,
                boxShadow: '0 0 20px rgba(0,212,255,0.4)'
              }}
            >
              <Send size={13} />
              + Dispatch New Mission
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {/* Metric 1 */}
        <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '3px solid var(--brand-primary)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Total Dispatched
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>
            {stats.total_dispatched}
          </div>
          <div style={{ fontSize: 11, color: 'var(--brand-primary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={12} /> All Registered Orders
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '3px solid var(--brand-accent)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            In-Flight (En Route)
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono', color: 'var(--brand-accent)' }}>
            {stats.currently_active}
          </div>
          <div style={{ fontSize: 11, color: 'var(--brand-accent)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Radio size={12} /> Live Telemetry Monitored
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '3px solid #00d4ff' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Successfully Delivered
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono', color: '#00d4ff' }}>
            {stats.delivered_count}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} color="#00d4ff" /> Verified Customer Drops
          </div>
        </div>

        {/* Metric 4 — Aborted */}
        <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '3px solid var(--brand-warning)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Aborted Missions
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono', color: 'var(--brand-warning)' }}>
            {stats.aborted_count ?? 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--brand-warning)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Shield size={12} /> RTB / Parachute Events
          </div>
        </div>

        {/* Metric 5 */}
        <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '3px solid #a78bfa' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Delivery Success Rate
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono', color: '#c4b5fd' }}>
            {stats.success_rate?.toFixed(0)}%
          </div>
          <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Shield size={12} /> Zero Incident Corridors
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 20,
        paddingBottom: 4,
      }}>
        <button
          onClick={() => setActiveTab('live')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: activeTab === 'live' ? '1px solid var(--brand-accent)' : '1px solid transparent',
            background: activeTab === 'live' ? 'rgba(6,255,165,0.14)' : 'transparent',
            color: activeTab === 'live' ? 'var(--brand-accent)' : 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            transition: 'all 150ms ease'
          }}
        >
          <Radio size={14} />
          Active In-Flight Missions ({missionsData.active_missions.length})
        </button>

        <button
          onClick={() => setActiveTab('delivered')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: activeTab === 'delivered' ? '1px solid var(--brand-primary)' : '1px solid transparent',
            background: activeTab === 'delivered' ? 'rgba(0,212,255,0.14)' : 'transparent',
            color: activeTab === 'delivered' ? 'var(--brand-primary)' : 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            transition: 'all 150ms ease'
          }}
        >
          <CheckCircle2 size={14} />
          Delivered Orders History ({missionsData.delivered_missions.length})
        </button>
      </div>

      {/* ── TAB 1: ACTIVE IN-FLIGHT MISSIONS ── */}
      {activeTab === 'live' && (
        <div>
          {missionsData.active_missions.length === 0 ? (
            <div className="glass-card" style={{
              padding: 40,
              textAlign: 'center',
              background: 'rgba(5, 12, 24, 0.4)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 12,
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🚁</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                No Drones Currently Delivering
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 20px auto' }}>
                All fleet units are currently on standby or ready for deployment at the BKC central logistics base.
              </p>
              {onGoToDispatch && (
                <button
                  className="btn btn-primary"
                  onClick={onGoToDispatch}
                  style={{ padding: '10px 24px' }}
                >
                  <Send size={14} /> Assign Drone & Launch Order
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: 16,
            }}>
              {missionsData.active_missions.map((m) => (
                <div key={m.order_id} className="glass-card" style={{
                  padding: 20,
                  borderTop: '2px solid var(--brand-accent)',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(6,255,165,0.15)',
                        border: '1px solid rgba(6,255,165,0.3)',
                        color: 'var(--brand-accent)',
                        letterSpacing: '0.6px',
                        textTransform: 'uppercase'
                      }}>
                        {m.order_id}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="status-chip DELIVERING">
                        ● EN ROUTE
                      </span>
                    </div>
                  </div>

                  {/* Destination & Drone */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={16} color="var(--brand-primary)" />
                      {m.destination_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Drone: <strong style={{ color: 'var(--text-primary)' }}>{m.drone_id}</strong> ({m.drone_model}) • Pilot: <strong style={{ color: 'var(--brand-primary)' }}>{m.agent_name}</strong>
                    </div>
                  </div>

                  {/* Flight Progress Bar */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span>Corridor Progress</span>
                      <span className="text-mono" style={{ color: 'var(--brand-accent)' }}>{m.progress_pct}%</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${m.progress_pct}%`,
                        background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-accent))',
                        borderRadius: 6,
                        boxShadow: '0 0 10px rgba(6,255,165,0.6)',
                        transition: 'width 0.8s ease'
                      }} />
                    </div>
                  </div>

                  {/* Telemetry Stats Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(8,15,31,0.6)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: 12,
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Battery</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-accent)', fontFamily: 'JetBrains Mono' }}>
                        {m.battery_pct}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payload</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono' }}>
                        {m.payload_kg} kg
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Speed</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'JetBrains Mono' }}>
                        {m.speed_kmh} km/h
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>FSI Score</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa', fontFamily: 'JetBrains Mono' }}>
                        {m.fsi}/100
                      </div>
                    </div>
                  </div>

                  {/* Dispatched Time footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
                    <span>Dispatched: {m.dispatched_at}</span>
                    <span>Remaining: ~{m.dist_remaining_km} km</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: DELIVERED ORDERS HISTORY LOG ── */}
      {activeTab === 'delivered' && (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
              Completed Delivery Log Book
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Showing {missionsData.delivered_missions.length} delivered orders
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: 12,
            }}>
              <thead>
                <tr style={{
                  background: 'rgba(8,15,31,0.8)',
                  borderBottom: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  <th style={{ padding: '12px 16px' }}>Order ID</th>
                  <th style={{ padding: '12px 16px' }}>Drone Unit</th>
                  <th style={{ padding: '12px 16px' }}>Delivery Agent</th>
                  <th style={{ padding: '12px 16px' }}>Destination Hub</th>
                  <th style={{ padding: '12px 16px' }}>Payload</th>
                  <th style={{ padding: '12px 16px' }}>Flight Distance</th>
                  <th style={{ padding: '12px 16px' }}>Final Battery</th>
                  <th style={{ padding: '12px 16px' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px' }}>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {missionsData.delivered_missions.map((dm, idx) => (
                  <tr
                    key={dm.order_id || idx}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      transition: 'background 120ms ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}
                  >
                    <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--brand-primary)' }}>
                      {dm.order_id}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {dm.drone_id} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({dm.drone_model})</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {dm.agent_name}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {dm.destination_name}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono' }}>
                      {dm.payload_kg} kg
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)' }}>
                      {dm.distance_km} km
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono', color: 'var(--brand-accent)' }}>
                      {dm.final_battery_pct}%
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 11 }}>
                      {dm.delivered_at || dm.aborted_at || 'Recent'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {dm.status === 'DELIVERED' && (
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 6,
                          background: 'rgba(6,255,165,0.15)',
                          border: '1px solid rgba(6,255,165,0.35)',
                          color: 'var(--brand-accent)',
                          letterSpacing: '0.4px',
                          textTransform: 'uppercase',
                        }}>
                          ✓ DELIVERED
                        </span>
                      )}
                      {dm.status === 'ABORTED_RTB' && (
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 6,
                          background: 'rgba(251,191,36,0.15)',
                          border: '1px solid rgba(251,191,36,0.35)',
                          color: 'var(--brand-warning)',
                          letterSpacing: '0.4px',
                          textTransform: 'uppercase',
                        }}>
                          ↩ RTB ABORT
                        </span>
                      )}
                      {dm.status === 'PARACHUTE_ABORT' && (
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 6,
                          background: 'rgba(255,61,87,0.15)',
                          border: '1px solid rgba(255,61,87,0.35)',
                          color: 'var(--brand-danger)',
                          letterSpacing: '0.4px',
                          textTransform: 'uppercase',
                        }}>
                          ⛑ PARACHUTE
                        </span>
                      )}
                      {!['DELIVERED', 'ABORTED_RTB', 'PARACHUTE_ABORT'].includes(dm.status) && (
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 6,
                          background: 'rgba(100,100,100,0.15)',
                          border: '1px solid rgba(100,100,100,0.3)',
                          color: 'var(--text-muted)',
                          letterSpacing: '0.4px',
                          textTransform: 'uppercase',
                        }}>
                          {dm.status || 'UNKNOWN'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
