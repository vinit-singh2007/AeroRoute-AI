// AeroRoute — Dedicated Live Drones Fleet Page
// Real-time tracking of every assigned, delivering, and standby drone
import { useState, useMemo } from 'react';
import {
  Radio,
  Send,
  Navigation,
  Battery,
  Zap,
  Wind,
  Shield,
  MapPin,
  Package,
  Search,
  Filter,
  Trash2,
  Lock,
  X,
  ExternalLink,
  RefreshCw,
  Gauge,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { deleteDrone } from '../services/api';
import { toast } from './Toast';

export default function LiveDronesPage({
  drones = [],
  onTrackOnMap,
  onGoToDispatch,
  onRefreshFleet,
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [droneToDelete, setDroneToDelete] = useState(null);
  const [deleteSecretCode, setDeleteSecretCode] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Computed summary metrics
  const stats = useMemo(() => {
    const total = drones.length;
    const delivering = drones.filter(d => ['IN_FLIGHT', 'DELIVERING'].includes(d.status)).length;
    const assigned = drones.filter(d => d.order_id && d.order_id !== 'STANDBY' && !['IN_FLIGHT', 'DELIVERING'].includes(d.status)).length;
    const rtb = drones.filter(d => ['RTB', 'RETURNING'].includes(d.status)).length;
    const idle = drones.filter(d => ['STANDBY', 'IDLE', 'READY', 'DELIVERED'].includes(d.status)).length;
    const avgBattery = total > 0
      ? Math.round(drones.reduce((acc, d) => acc + (d.battery_pct || 0), 0) / total)
      : 0;

    return { total, delivering, assigned, rtb, idle, avgBattery };
  }, [drones]);

  // Filter and search drones
  const filteredDrones = useMemo(() => {
    return drones.filter(drone => {
      // Status filter
      if (statusFilter === 'DELIVERING' && !['IN_FLIGHT', 'DELIVERING'].includes(drone.status)) {
        return false;
      }
      if (statusFilter === 'ASSIGNED' && (!drone.order_id || drone.order_id === 'STANDBY')) {
        return false;
      }
      if (statusFilter === 'RTB' && !['RTB', 'RETURNING'].includes(drone.status)) {
        return false;
      }
      if (statusFilter === 'IDLE' && !['STANDBY', 'IDLE', 'READY', 'DELIVERED'].includes(drone.status)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = drone.id?.toLowerCase().includes(q);
        const modelMatch = drone.model?.toLowerCase().includes(q);
        const orderMatch = drone.order_id?.toLowerCase().includes(q);
        const destMatch = drone.destination_name?.toLowerCase().includes(q);
        if (!idMatch && !modelMatch && !orderMatch && !destMatch) return false;
      }

      return true;
    });
  }, [drones, statusFilter, searchQuery]);

  // Decommission Drone with Secret Code Verification
  const handleConfirmDecommission = async (e) => {
    e.preventDefault();
    if (!droneToDelete) return;
    if (!deleteSecretCode.trim()) {
      toast('Please enter the secret authorization code to delete this drone', 'warning');
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteDrone(droneToDelete, deleteSecretCode.trim());
      toast(`Airframe ${droneToDelete} authorized and decommissioned from active fleet!`, 'success');
      setDroneToDelete(null);
      setDeleteSecretCode('');
      onRefreshFleet?.();
    } catch (err) {
      toast(`Decommission failed: ${err.message}`, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div style={{
      height: '100%',
      maxHeight: '100%',
      width: '100%',
      minWidth: 0,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: '#030a17',
      overflowY: 'auto',
      boxSizing: 'border-box',
      padding: '24px 32px',
    }}>

      {/* ── HEADER TITLE & TOP BAR ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'radial-gradient(circle at 30% 30%, rgba(0,212,255,0.3), rgba(6,255,165,0.15))',
            border: '1.5px solid rgba(0,212,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0,212,255,0.25)',
          }}>
            <Radio size={22} color="var(--brand-primary)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '0.4px' }}>
                Live Fleet Drones
              </h1>
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--brand-accent)',
                background: 'rgba(6,255,165,0.12)',
                border: '1px solid rgba(6,255,165,0.35)',
                padding: '2px 8px',
                borderRadius: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-accent)', display: 'inline-block' }} />
                REAL-TIME STREAM
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              Monitoring every assigned cargo mission, delivering airframe, and active telemetry across MMR airspace
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onRefreshFleet}
            title="Refresh Fleet Telemetry"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '7px 12px' }}
          >
            <RefreshCw size={12} /> Sync Telemetry
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onGoToDispatch}
            id="live-drones-dispatch-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '7px 14px' }}
          >
            <Send size={12} /> Dispatch New Mission
          </button>
        </div>
      </div>

      {/* ── TOP STATS METRIC CARDS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}>
        {[
          { label: 'Total Fleet Airframes', value: stats.total, color: 'var(--brand-primary)', icon: <Radio size={16} />, sub: 'Connected Units' },
          { label: 'Actively Delivering', value: stats.delivering, color: 'var(--brand-accent)', icon: <Navigation size={16} />, sub: 'En Route in MMR' },
          { label: 'Mission Assigned', value: stats.assigned, color: '#818cf8', icon: <Package size={16} />, sub: 'Awaiting Takeoff' },
          { label: 'Returning / RTB', value: stats.rtb, color: 'var(--brand-warning)', icon: <Zap size={16} />, sub: 'Base Approach' },
          { label: 'Avg Fleet Charge', value: `${stats.avgBattery}%`, color: stats.avgBattery > 40 ? 'var(--brand-accent)' : 'var(--brand-danger)', icon: <Battery size={16} />, sub: 'Healthy Reserves' },
        ].map((card, idx) => (
          <div
            key={idx}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(8, 16, 33, 0.85)',
              border: '1px solid rgba(0, 212, 255, 0.12)',
              backdropFilter: 'blur(16px)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {card.label}
              </span>
              <span style={{ color: card.color, opacity: 0.8 }}>{card.icon}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: card.color, fontFamily: 'JetBrains Mono, monospace' }}>
              {card.value}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── FILTER & SEARCH BAR ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 10,
        background: 'rgba(8, 16, 33, 0.75)',
        border: '1px solid var(--border-subtle)',
        marginBottom: 20,
      }}>
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All (${drones.length})` },
            { id: 'DELIVERING', label: `🚀 Delivering (${stats.delivering})` },
            { id: 'ASSIGNED', label: `📦 Assigned (${stats.assigned})` },
            { id: 'IDLE', label: `🟢 Standby (${stats.idle})` },
            { id: 'RTB', label: `⚡ RTB (${stats.rtb})` },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: statusFilter === tab.id ? '1px solid var(--brand-primary)' : '1px solid rgba(255,255,255,0.06)',
                background: statusFilter === tab.id ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255,255,255,0.02)',
                color: statusFilter === tab.id ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search Drone, Model, Order..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: 30,
              fontSize: 11,
              height: 32,
              background: 'rgba(5, 12, 24, 0.8)',
              borderColor: 'rgba(0, 212, 255, 0.2)',
            }}
          />
        </div>
      </div>

      {/* ── DRONE CARDS GRID ── */}
      {filteredDrones.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 16,
          marginBottom: 32,
          width: '100%',
        }}>
          {filteredDrones.map(drone => {
            const isDelivering = ['IN_FLIGHT', 'DELIVERING'].includes(drone.status);
            const isRtb = ['RTB', 'RETURNING'].includes(drone.status);
            const isAssigned = drone.order_id && drone.order_id !== 'STANDBY';
            const batteryLevel = drone.battery_pct > 50 ? 'var(--brand-accent)' : drone.battery_pct > 25 ? 'var(--brand-warning)' : 'var(--brand-danger)';

            return (
              <div
                key={drone.id}
                style={{
                  background: 'rgba(8, 16, 33, 0.85)',
                  border: isDelivering
                    ? '1.5px solid rgba(0, 212, 255, 0.45)'
                    : isRtb
                      ? '1.5px solid rgba(251, 191, 36, 0.4)'
                      : '1px solid rgba(0, 212, 255, 0.15)',
                  borderRadius: 12,
                  padding: 18,
                  backdropFilter: 'blur(20px)',
                  boxShadow: isDelivering
                    ? '0 0 20px rgba(0, 212, 255, 0.15)'
                    : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  transition: 'all 200ms ease',
                }}
              >
                {/* Drone Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      background: 'rgba(0, 212, 255, 0.08)',
                      border: '1px solid rgba(0, 212, 255, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                    }}>
                      🚁
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
                          {drone.id}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          • {drone.model}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <span>Capacity: {drone.max_payload_kg || 4.0} kg</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    background: isDelivering
                      ? 'rgba(0, 212, 255, 0.15)'
                      : isRtb
                        ? 'rgba(251, 191, 36, 0.15)'
                        : 'rgba(6, 255, 165, 0.12)',
                    color: isDelivering
                      ? 'var(--brand-primary)'
                      : isRtb
                        ? 'var(--brand-warning)'
                        : 'var(--brand-accent)',
                    border: isDelivering
                      ? '1px solid rgba(0, 212, 255, 0.4)'
                      : isRtb
                        ? '1px solid rgba(251, 191, 36, 0.4)'
                        : '1px solid rgba(6, 255, 165, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <span style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: isDelivering ? 'var(--brand-primary)' : isRtb ? 'var(--brand-warning)' : 'var(--brand-accent)',
                      display: 'inline-block',
                    }} />
                    {drone.status || 'STANDBY'}
                  </span>
                </div>

                {/* Assigned Delivery Order Banner */}
                {isAssigned ? (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: isDelivering ? 'rgba(0, 212, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    border: isDelivering ? '1px solid rgba(0, 212, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand-accent)', letterSpacing: '0.5px' }}>
                        📦 ACTIVE ORDER: {drone.order_id}
                      </span>
                      {drone.payload_weight_kg && (
                        <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                          Cargo: {drone.payload_weight_kg.toFixed(1)} kg
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} color="var(--brand-primary)" />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {drone.destination_name || 'Assigned Destination Point'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px dashed rgba(255, 255, 255, 0.08)',
                    fontSize: 10.5,
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <span>🏭</span> Standing by at MMR Central Logistics Base
                  </div>
                )}

                {/* Live Flight Telemetry Numbers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  padding: '8px 10px',
                  background: 'rgba(5, 12, 24, 0.6)',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>ALTITUDE</div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {drone.altitude_m ? `${drone.altitude_m.toFixed(0)} m` : '120 m'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>SPEED</div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {drone.speed_ms ? `${(drone.speed_ms * 3.6).toFixed(0)} km/h` : '62 km/h'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>GPS COORD</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {drone.lat ? `${drone.lat.toFixed(3)}, ${drone.lng.toFixed(3)}` : '19.194, 72.855'}
                    </div>
                  </div>
                </div>

                {/* Battery Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Battery size={11} /> Battery Power
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: batteryLevel, fontFamily: 'JetBrains Mono, monospace' }}>
                      {drone.battery_pct !== undefined ? `${drone.battery_pct.toFixed(0)}%` : '100%'}
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: 5,
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(0, drone.battery_pct || 0))}%`,
                      height: '100%',
                      background: batteryLevel,
                      borderRadius: 10,
                      transition: 'width 300ms ease',
                    }} />
                  </div>
                </div>

                {/* Action Buttons: Track on Map & Decommission */}
                <div style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 2,
                  paddingTop: 8,
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                }}>
                  <button
                    type="button"
                    onClick={() => onTrackOnMap?.(drone.id)}
                    id={`btn-track-3d-${drone.id}`}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      background: 'rgba(0, 212, 255, 0.14)',
                      border: '1px solid rgba(0, 212, 255, 0.5)',
                      color: 'var(--brand-primary)',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      borderRadius: 6,
                      padding: '7px 12px',
                      boxShadow: '0 0 12px rgba(0, 212, 255, 0.15)',
                    }}
                    title={`Open dedicated CesiumJS 3D Photorealistic Tracking View for ${drone.id}`}
                  >
                    <Navigation size={12} /> TRACK ON LIVE MAP
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDroneToDelete(drone.id);
                      setDeleteSecretCode('');
                    }}
                    className="btn btn-ghost btn-sm"
                    style={{
                      padding: '6px 10px',
                      color: 'var(--brand-danger)',
                      borderColor: 'rgba(255, 61, 87, 0.3)',
                      fontSize: 10.5,
                      cursor: 'pointer',
                    }}
                    title={`Decommission ${drone.id} (Requires Secret Code)`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          padding: 48,
          textAlign: 'center',
          borderRadius: 12,
          background: 'rgba(8, 16, 33, 0.6)',
          border: '1px dashed rgba(0, 212, 255, 0.2)',
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🛰️</div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            No Matching Drones Found
          </h3>
          <p style={{ margin: '0 auto 16px', maxWidth: 400, fontSize: 12, color: 'var(--text-secondary)' }}>
            No airframes currently match your filter criteria or search query. You can reset filters or dispatch a new delivery drone.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
            >
              Reset Filters
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onGoToDispatch}
            >
              <Send size={12} style={{ marginRight: 4 }} /> Go to Mission Dispatch
            </button>
          </div>
        </div>
      )}

      {/* ── AUTHORIZE SINGLE DRONE DECOMMISSION MODAL ── */}
      {droneToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
        }}>
          <form
            onSubmit={handleConfirmDecommission}
            style={{
              width: 380,
              padding: 22,
              background: 'rgba(8, 16, 33, 0.98)',
              border: '1px solid rgba(255, 61, 87, 0.45)',
              borderRadius: 12,
              boxShadow: '0 20px 50px rgba(0,0,0,0.85)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔐</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--brand-danger)', textTransform: 'uppercase' }}>
                  Authorize Decommission
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDroneToDelete(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: '1.5' }}>
              Decommissioning airframe <strong style={{ color: '#fff' }}>{droneToDelete}</strong> from active fleet and database. Please enter its secret authorization code:
            </p>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Lock size={11} color="var(--brand-primary)" /> Secret Authorization Code
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter secret authorization code"
                value={deleteSecretCode}
                onChange={e => setDeleteSecretCode(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setDroneToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm"
                style={{
                  background: 'var(--brand-danger)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 800,
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  padding: '7px 16px',
                  borderRadius: 6,
                }}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Verifying...' : 'Confirm Decommission'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
