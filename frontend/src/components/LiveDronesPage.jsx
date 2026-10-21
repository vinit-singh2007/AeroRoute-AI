// AeroRoute — Dedicated Live Drones Fleet Page
// Real-time tracking of every assigned, delivering, and standby drone
import { useState, useMemo } from 'react';
import {
  Radio,
  Send,
  Navigation,
  Battery,
  Zap,
  MapPin,
  Package,
  Search,
  Lock,
  X,
  RefreshCw,
  AlertTriangle,
  PlusCircle,
  AlertOctagon,
  RotateCcw,
  ArrowDownToLine,
  CheckCircle2,
  Info,
  Trash2,
} from 'lucide-react';
import { addDrone, deleteDrone, emergencyRTB, parachuteDeploy } from '../services/api';
import { toast } from './Toast';

export default function LiveDronesPage({
  drones = [],
  onTrackOnMap,
  onTrackIn3D,
  onGoToDispatch,
  onRefreshFleet,
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [droneToDelete, setDroneToDelete] = useState(null);
  const [deleteSecretCode, setDeleteSecretCode] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Emergency modal state
  const [emergencyModal, setEmergencyModal] = useState(null); // { type: 'rtb'|'parachute', droneId, drone }
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  // New Drone Form Modal State
  const [showAddDrone, setShowAddDrone] = useState(false);
  const [newDroneId, setNewDroneId] = useState('');
  const [newDroneModel, setNewDroneModel] = useState('OctoCopter HeavyLifter');
  const [newDronePayload, setNewDronePayload] = useState(4.5);
  const [newDroneBattery, setNewDroneBattery] = useState(100);
  const [newDroneSpeed, setNewDroneSpeed] = useState(65);
  const [newDroneSecretCode, setNewDroneSecretCode] = useState('');
  const [addLoading, setAddLoading] = useState(false);


  // Computed summary metrics
  const stats = useMemo(() => {
    const total = drones.length;
    const inMotion = drones.filter(d => ['IN_FLIGHT', 'DELIVERING', 'RETURNING', 'RTB'].includes(d.status)).length;
    const delivering = drones.filter(d => ['IN_FLIGHT', 'DELIVERING'].includes(d.status)).length;
    const assigned = drones.filter(d => d.order_id && d.order_id !== 'STANDBY' && !['IN_FLIGHT', 'DELIVERING'].includes(d.status)).length;
    const rtb = drones.filter(d => ['RTB', 'RETURNING'].includes(d.status)).length;
    const idle = drones.filter(d => ['STANDBY', 'IDLE', 'READY', 'DELIVERED'].includes(d.status)).length;
    const avgBattery = total > 0
      ? Math.round(drones.reduce((acc, d) => acc + (d.battery_pct || 0), 0) / total)
      : 0;

    return { total, inMotion, delivering, assigned, rtb, idle, avgBattery };
  }, [drones]);

  // Filter and search drones
  const filteredDrones = useMemo(() => {
    return drones.filter(drone => {
      if (statusFilter === 'IN_MOTION' && !['IN_FLIGHT', 'DELIVERING', 'RETURNING', 'RTB'].includes(drone.status)) return false;
      if (statusFilter === 'DELIVERING' && !['IN_FLIGHT', 'DELIVERING'].includes(drone.status)) return false;
      if (statusFilter === 'ASSIGNED' && (!drone.order_id || drone.order_id === 'STANDBY')) return false;
      if (statusFilter === 'RTB' && !['RTB', 'RETURNING'].includes(drone.status)) return false;
      if (statusFilter === 'IDLE' && !['STANDBY', 'IDLE', 'READY', 'DELIVERED'].includes(drone.status)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (
          !drone.id?.toLowerCase().includes(q) &&
          !drone.model?.toLowerCase().includes(q) &&
          !drone.order_id?.toLowerCase().includes(q) &&
          !drone.destination_name?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [drones, statusFilter, searchQuery]);

  // Decommission
  const handleConfirmDecommission = async (e) => {
    e.preventDefault();
    if (!droneToDelete) return;
    if (!deleteSecretCode.trim()) {
      toast('Please enter the secret authorization code', 'warning');
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteDrone(droneToDelete, deleteSecretCode.trim());
      toast(`Airframe ${droneToDelete} decommissioned from active fleet!`, 'success');
      setDroneToDelete(null);
      setDeleteSecretCode('');
      onRefreshFleet?.();
    } catch (err) {
      toast(`Decommission failed: ${err.message}`, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Register New Drone to Fleet
  const handleRegisterDrone = async (e) => {
    e.preventDefault();
    if (!newDroneId.trim()) {
      toast('Please enter a unique Drone ID (e.g. BOM-AIR-05)', 'warning');
      return;
    }
    if (!newDroneSecretCode.trim()) {
      toast('Please enter a Secret Code/PIN (required to delete later)', 'warning');
      return;
    }

    setAddLoading(true);
    try {
      await addDrone({
        id: newDroneId.trim().toUpperCase(),
        model: newDroneModel.trim(),
        max_payload_kg: parseFloat(newDronePayload),
        battery_pct: parseFloat(newDroneBattery),
        max_speed_kmh: parseFloat(newDroneSpeed),
        secret_code: newDroneSecretCode.trim(),
      });
      toast(`Drone ${newDroneId.toUpperCase()} registered & enlisted into fleet!`, 'success');
      setNewDroneId('');
      setNewDroneSecretCode('');
      setShowAddDrone(false);
      onRefreshFleet?.();
    } catch (err) {
      toast(`Failed to register drone: ${err.message}`, 'error');
    } finally {
      setAddLoading(false);
    }
  };

  // Emergency RTB confirm
  const handleEmergencyRTB = async () => {
    if (!emergencyModal) return;
    setEmergencyLoading(true);
    try {
      const res = await emergencyRTB(emergencyModal.droneId);
      toast(`🏠 Emergency RTB initiated for ${emergencyModal.droneId}. ETA: ${res.eta_minutes?.toFixed(1) ?? '?'} min back to hub.`, 'warning');
      setEmergencyModal(null);
      onRefreshFleet?.();
    } catch (err) {
      toast(`RTB failed: ${err.message}`, 'error');
    } finally {
      setEmergencyLoading(false);
    }
  };

  // Parachute confirm
  const handleParachuteDeploy = async () => {
    if (!emergencyModal) return;
    setEmergencyLoading(true);
    try {
      const res = await parachuteDeploy(emergencyModal.droneId);
      toast(`⛑️ Parachute deployed for ${emergencyModal.droneId} at (${res.deploy_lat}, ${res.deploy_lng}). Recovery dispatched.`, 'error');
      setEmergencyModal(null);
      onRefreshFleet?.();
    } catch (err) {
      toast(`Parachute deploy failed: ${err.message}`, 'error');
    } finally {
      setEmergencyLoading(false);
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

      {/* ── HEADER ── */}
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
            width: 44, height: 44, borderRadius: 12,
            background: 'radial-gradient(circle at 30% 30%, rgba(0,212,255,0.3), rgba(6,255,165,0.15))',
            border: '1.5px solid rgba(0,212,255,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                fontSize: 10, fontWeight: 800, color: 'var(--brand-accent)',
                background: 'rgba(6,255,165,0.12)', border: '1px solid rgba(6,255,165,0.35)',
                padding: '2px 8px', borderRadius: 12,
                display: 'inline-flex', alignItems: 'center', gap: 4,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowAddDrone(true)}
            id="live-drones-add-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              padding: '7px 14px',
              color: 'var(--brand-accent)',
              borderColor: 'rgba(6, 255, 165, 0.4)',
              background: 'rgba(6, 255, 165, 0.08)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <PlusCircle size={13} /> + Enlist Drone
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRefreshFleet}
            title="Refresh Fleet Telemetry"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '7px 12px' }}>
            <RefreshCw size={12} /> Sync Telemetry
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onGoToDispatch}
            id="live-drones-dispatch-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '7px 14px' }}>
            <Send size={12} /> Dispatch New Mission
          </button>
        </div>
      </div>

      {/* ── STATS CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Fleet Airframes', value: stats.total, color: 'var(--brand-primary)', icon: <Radio size={16} />, sub: 'Connected Units' },
          { label: 'Actively Delivering', value: stats.delivering, color: 'var(--brand-accent)', icon: <Navigation size={16} />, sub: 'En Route in MMR' },
          { label: 'Mission Assigned', value: stats.assigned, color: '#818cf8', icon: <Package size={16} />, sub: 'Awaiting Takeoff' },
          { label: 'Returning / RTB', value: stats.rtb, color: 'var(--brand-warning)', icon: <Zap size={16} />, sub: 'Base Approach' },
          { label: 'Avg Fleet Charge', value: `${stats.avgBattery}%`, color: stats.avgBattery > 40 ? 'var(--brand-accent)' : 'var(--brand-danger)', icon: <Battery size={16} />, sub: 'Healthy Reserves' },
        ].map((card, idx) => (
          <div key={idx} style={{
            padding: '12px 16px', borderRadius: 10,
            background: 'rgba(8, 16, 33, 0.85)',
            border: '1px solid rgba(0, 212, 255, 0.12)',
            backdropFilter: 'blur(16px)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</span>
              <span style={{ color: card.color, opacity: 0.8 }}>{card.icon}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: card.color, fontFamily: 'JetBrains Mono, monospace' }}>{card.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── FILTER & SEARCH ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        padding: '12px 16px', borderRadius: 10,
        background: 'rgba(8, 16, 33, 0.75)',
        border: '1px solid var(--border-subtle)',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All (${drones.length})` },
            { id: 'IN_MOTION', label: `🚀 In Motion (${stats.inMotion})` },
            { id: 'DELIVERING', label: `📦 Delivering (${stats.delivering})` },
            { id: 'RTB', label: `⚡ RTB (${stats.rtb})` },
            { id: 'IDLE', label: `🟢 Standby (${stats.idle})` },
          ].map(tab => (
            <button key={tab.id} type="button" onClick={() => setStatusFilter(tab.id)} style={{
              padding: '6px 12px', borderRadius: 6,
              border: statusFilter === tab.id ? '1px solid var(--brand-primary)' : '1px solid rgba(255,255,255,0.06)',
              background: statusFilter === tab.id ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255,255,255,0.02)',
              color: statusFilter === tab.id ? 'var(--brand-primary)' : 'var(--text-secondary)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 150ms ease',
            }}>{tab.label}</button>
          ))}
        </div>
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text" className="form-input"
            placeholder="Search Drone, Model, Order..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 30, fontSize: 11, height: 32, background: 'rgba(5, 12, 24, 0.8)', borderColor: 'rgba(0, 212, 255, 0.2)' }}
          />
        </div>
      </div>

      {/* ── DRONE CARDS — FULL WIDTH SINGLE COLUMN ── */}
      {filteredDrones.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32, width: '100%' }}>
          {filteredDrones.map(drone => {
            const isDelivering = ['IN_FLIGHT', 'DELIVERING'].includes(drone.status);
            const isRtb = ['RTB', 'RETURNING'].includes(drone.status);
            const isParachuted = drone.status === 'PARACHUTE_DEPLOYED';
            const isAirborne = isDelivering || isRtb || isParachuted;
            const isAssigned = drone.order_id && drone.order_id !== 'STANDBY';

            // Real-time Flight Hazard / Issue Detection (Wind, Weather, Battery, FSI, Action status)
            const windSpeed = Number(drone.wind_gust_ms || 0);
            const batteryPct = Number(drone.battery_pct || 0);
            const fsiScore = Number(drone.fsi ?? 100);
            const isHighWind = windSpeed > 15;
            const isLowBattery = batteryPct < 25;
            const isLowFSI = fsiScore < 40;
            const isCriticalAction = drone.action_status === 'CRITICAL' || drone.action_status === 'WARNING';
            // Unresolved hazard requiring intervention — only if not already returning or halted
            const hasHazard = (isAirborne && !isParachuted && !isRtb) && (isHighWind || isLowBattery || isLowFSI || isCriticalAction);

            const batteryLevel = batteryPct > 50
              ? 'var(--brand-accent)'
              : batteryPct > 25
              ? 'var(--brand-warning)'
              : 'var(--brand-danger)';

            const cardBorder = isParachuted
              ? '2px solid rgba(255, 61, 87, 0.85)'
              : hasHazard
              ? '2px solid rgba(255, 61, 87, 0.9)'
              : isRtb
              ? '1.5px solid rgba(251, 191, 36, 0.65)'
              : isDelivering
              ? '1.5px solid rgba(0, 212, 255, 0.45)'
              : '1px solid rgba(0, 212, 255, 0.15)';

            const cardGlow = isParachuted
              ? '0 0 28px rgba(255, 61, 87, 0.35)'
              : hasHazard
              ? '0 0 32px rgba(255, 61, 87, 0.45)'
              : isRtb
              ? '0 0 22px rgba(251, 191, 36, 0.25)'
              : isDelivering
              ? '0 0 20px rgba(0, 212, 255, 0.15)'
              : 'none';

            const cardBackground = isParachuted
              ? 'radial-gradient(circle at 50% 0%, rgba(255, 61, 87, 0.14) 0%, rgba(8, 16, 33, 0.95) 70%)'
              : hasHazard
              ? 'radial-gradient(circle at 50% 0%, rgba(255, 61, 87, 0.18) 0%, rgba(8, 16, 33, 0.95) 60%)'
              : isRtb
              ? 'radial-gradient(circle at 50% 0%, rgba(251, 191, 36, 0.12) 0%, rgba(8, 16, 33, 0.95) 60%)'
              : 'rgba(8, 16, 33, 0.88)';

            return (
              <div key={drone.id} style={{
                background: cardBackground,
                border: cardBorder,
                borderRadius: 14,
                padding: '18px 22px',
                backdropFilter: 'blur(20px)',
                boxShadow: cardGlow,
                width: '100%',
                boxSizing: 'border-box',
                transition: 'all 200ms ease',
              }}>

                {/* ── CARD TOP ROW: Identity + Status ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 10,
                      background: isParachuted
                        ? 'rgba(255,61,87,0.16)'
                        : hasHazard
                        ? 'rgba(255,61,87,0.16)'
                        : isRtb
                        ? 'rgba(251,191,36,0.14)'
                        : 'rgba(0, 212, 255, 0.08)',
                      border: `1.5px solid ${isParachuted || hasHazard ? 'rgba(255,61,87,0.6)' : isRtb ? 'rgba(251,191,36,0.5)' : 'rgba(0, 212, 255, 0.25)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22,
                    }}>
                      {isParachuted ? '⛑️' : hasHazard ? '⚠️' : isRtb ? '🏠' : isDelivering ? '🚁' : '🏭'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 16, fontWeight: 900,
                          color: hasHazard ? '#ff3d57' : isRtb ? '#fbbf24' : '#fff',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>{drone.id}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>• {drone.model}</span>
                        {drone.max_payload_kg && (
                          <span style={{ fontSize: 10, color: 'var(--brand-primary)', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', padding: '1px 7px', borderRadius: 20 }}>
                            Max {drone.max_payload_kg} kg
                          </span>
                        )}
                        {drone.max_speed_kmh && (
                          <span style={{ fontSize: 10, color: 'var(--brand-accent)', background: 'rgba(6,255,165,0.08)', border: '1px solid rgba(6,255,165,0.2)', padding: '1px 7px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            ⚡ {drone.max_speed_kmh} km/h
                          </span>
                        )}
                      </div>
                      {isAssigned && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <MapPin size={10} color={hasHazard ? '#ff3d57' : isRtb ? '#fbbf24' : 'var(--brand-primary)'} />
                          <span style={{ color: '#fff', fontWeight: 600 }}>{isRtb ? 'MMR Central Hub (Return Approach)' : drone.destination_name || 'Assigned Destination'}</span>
                          {drone.order_id && drone.order_id !== 'STANDBY' && (
                            <span style={{ fontSize: 10, color: 'var(--brand-accent)', marginLeft: 4 }}>• {drone.order_id}</span>
                          )}
                        </div>
                      )}
                      {!isAssigned && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🏭 Standing by at MMR Central Logistics Base</div>
                      )}
                    </div>
                  </div>

                  {/* Status Badge only */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '4px 10px',
                      borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.5px',
                      background: isParachuted || hasHazard
                        ? 'rgba(255,61,87,0.22)'
                        : isRtb
                        ? 'rgba(251, 191, 36, 0.18)'
                        : isDelivering
                        ? 'rgba(0, 212, 255, 0.15)'
                        : 'rgba(6, 255, 165, 0.12)',
                      color: isParachuted || hasHazard
                        ? 'var(--brand-danger)'
                        : isRtb
                        ? 'var(--brand-warning)'
                        : isDelivering
                        ? 'var(--brand-primary)'
                        : 'var(--brand-accent)',
                      border: isParachuted || hasHazard
                        ? '1px solid rgba(255,61,87,0.6)'
                        : isRtb
                        ? '1px solid rgba(251, 191, 36, 0.5)'
                        : isDelivering
                        ? '1px solid rgba(0, 212, 255, 0.4)'
                        : '1px solid rgba(6, 255, 165, 0.3)',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                        background: isParachuted || hasHazard ? 'var(--brand-danger)' : isRtb ? 'var(--brand-warning)' : isDelivering ? 'var(--brand-primary)' : 'var(--brand-accent)',
                        boxShadow: hasHazard ? '0 0 8px #ff3d57' : isRtb ? '0 0 6px #fbbf24' : 'none',
                      }} />
                      {isParachuted ? '⛑️ PARACHUTE DEPLOYED' : hasHazard ? '⚠️ HAZARD ALERT' : isRtb ? '🏠 RETURNING (RTB)' : drone.status || 'STANDBY'}
                    </span>
                  </div>
                </div>

                {/* ── UNRESOLVED HAZARD ALERT BANNER (Turns RED when pilot action is needed) ── */}
                {hasHazard && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 14px',
                    borderRadius: 8,
                    background: 'rgba(255, 61, 87, 0.18)',
                    border: '1.5px solid rgba(255, 61, 87, 0.7)',
                    color: '#ff3d57',
                    fontSize: 11,
                    fontWeight: 800,
                    marginBottom: 12,
                    boxShadow: '0 0 18px rgba(255, 61, 87, 0.25)',
                  }}>
                    <AlertOctagon size={16} />
                    <span>
                      FLIGHT HAZARD DETECTED: {isHighWind ? `Severe Wind Gust (${windSpeed.toFixed(1)} m/s > 15 m/s) • ` : ''}
                      {isLowBattery ? `Critical Battery (${batteryPct.toFixed(0)}% < 25%) • ` : ''}
                      {isLowFSI ? `Compromised Safety Index (FSI ${fsiScore.toFixed(0)}/100) • ` : ''}
                      Immediate RTB or Parachute Deploy Recommended
                    </span>
                  </div>
                )}

                {/* ── RTB IN-PROGRESS BANNER (Calm Amber Protocol State) ── */}
                {isRtb && !isParachuted && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 14px',
                    borderRadius: 8,
                    background: 'rgba(251, 191, 36, 0.12)',
                    border: '1.5px solid rgba(251, 191, 36, 0.6)',
                    color: '#fbbf24',
                    fontSize: 11,
                    fontWeight: 800,
                    marginBottom: 12,
                    boxShadow: '0 0 14px rgba(251, 191, 36, 0.18)',
                  }}>
                    <RotateCcw size={15} style={{ animation: 'spin 3s linear infinite' }} />
                    <span>
                      RETURN TO BASE ACTIVE (RTB): Drone mission aborted. Navigating safely to MMR Central Hub via A* corridor.
                    </span>
                  </div>
                )}

                {/* ── TELEMETRY ROW (100% REAL LIVE DATA, NO HARDCODED VALUES) ── */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: 8,
                  padding: '10px 14px',
                  background: hasHazard
                    ? 'rgba(255, 61, 87, 0.1)'
                    : isRtb
                    ? 'rgba(251, 191, 36, 0.08)'
                    : 'rgba(5, 12, 24, 0.6)',
                  borderRadius: 10,
                  border: hasHazard
                    ? '1px solid rgba(255, 61, 87, 0.45)'
                    : isRtb
                    ? '1px solid rgba(251, 191, 36, 0.4)'
                    : '1px solid var(--border-subtle)',
                  textAlign: 'center',
                  marginBottom: 12,
                }}>
                  {[
                    {
                      label: 'ALTITUDE',
                      value: drone.altitude_m != null ? `${Number(drone.altitude_m).toFixed(0)} m` : '—',
                      color: hasHazard ? '#ff3d57' : isRtb ? '#fbbf24' : 'var(--text-primary)',
                    },
                    {
                      label: 'SPEED',
                      value: drone.speed_kmh != null ? `${Number(drone.speed_kmh).toFixed(0)} km/h` : '—',
                      color: Number(drone.speed_kmh) > 70 ? '#fbbf24' : 'var(--text-primary)',
                    },
                    {
                      label: 'HEADING',
                      value: drone.heading_deg != null ? `${Number(drone.heading_deg).toFixed(0)}°` : '—',
                    },
                    {
                      label: 'WIND',
                      value: drone.wind_gust_ms != null ? `${Number(drone.wind_gust_ms).toFixed(1)} m/s` : '—',
                      color: isHighWind ? '#ff3d57' : Number(drone.wind_gust_ms) > 8 ? '#fbbf24' : 'var(--brand-accent)',
                    },
                    {
                      label: 'FSI',
                      value: drone.fsi != null ? `${Number(drone.fsi).toFixed(0)}%` : '—',
                      color: isLowFSI ? '#ff3d57' : Number(drone.fsi) > 65 ? 'var(--brand-accent)' : '#fbbf24',
                    },
                    {
                      label: 'GPS',
                      value: (drone.lat != null && drone.lng != null) ? `${Number(drone.lat).toFixed(3)}, ${Number(drone.lng).toFixed(3)}` : '—',
                      small: true,
                    },
                  ].map((item, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 3 }}>{item.label}</div>
                      <div style={{
                        fontSize: item.small ? 9.5 : 12, fontWeight: 800,
                        color: item.color || 'var(--text-primary)',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* ── BATTERY BAR ── */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Battery size={11} /> Battery Power
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: batteryLevel, fontFamily: 'JetBrains Mono, monospace' }}>
                      {drone.battery_pct !== undefined ? `${drone.battery_pct.toFixed(0)}%` : '100%'}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(0, drone.battery_pct || 0))}%`,
                      height: '100%', background: batteryLevel, borderRadius: 10, transition: 'width 300ms ease',
                    }} />
                  </div>
                  {drone.battery_pct < 25 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 10, color: 'var(--brand-danger)', fontWeight: 700 }}>
                      <AlertTriangle size={10} /> Critical battery — emergency intervention recommended
                    </div>
                  )}
                </div>

                {/* ── EMERGENCY CONTROLS — Only for airborne drones ── */}
                {isAirborne && !isParachuted && (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(255, 61, 87, 0.05)',
                    border: '1px solid rgba(255, 61, 87, 0.25)',
                    marginBottom: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <AlertOctagon size={13} color="var(--brand-danger)" />
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--brand-danger)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                        Emergency Intervention Controls
                      </span>
                      <span style={{ fontSize: 9.5, color: 'var(--text-muted)', marginLeft: 4 }}>— Use only in critical situations</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {/* RTB Button / Active State */}
                      {isRtb ? (
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: 'rgba(251, 191, 36, 0.16)',
                            border: '1.5px solid rgba(251, 191, 36, 0.65)',
                            color: 'var(--brand-warning)',
                            fontSize: 11.5,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            letterSpacing: '0.3px',
                          }}
                        >
                          <CheckCircle2 size={15} />
                          ✓ RTB In Progress
                        </div>
                      ) : (
                        <button
                          type="button"
                          id={`btn-rtb-${drone.id}`}
                          onClick={() => setEmergencyModal({ type: 'rtb', droneId: drone.id, drone })}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 8,
                            background: 'rgba(251, 191, 36, 0.1)',
                            border: '1px solid rgba(251, 191, 36, 0.5)',
                            color: 'var(--brand-warning)',
                            fontSize: 11.5,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            transition: 'all 150ms ease',
                            letterSpacing: '0.3px',
                          }}
                          title="Abort mission and return drone to MMR Central Hub via A* safe route"
                        >
                          <RotateCcw size={14} />
                          🏠 Return to Base (RTB)
                        </button>
                      )}

                      {/* Parachute Button */}
                      <button
                        type="button"
                        id={`btn-parachute-${drone.id}`}
                        onClick={() => setEmergencyModal({ type: 'parachute', droneId: drone.id, drone })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 8,
                          background: 'rgba(255, 61, 87, 0.1)',
                          border: '1px solid rgba(255, 61, 87, 0.55)',
                          color: 'var(--brand-danger)',
                          fontSize: 11.5,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          transition: 'all 150ms ease',
                          letterSpacing: '0.3px',
                        }}
                        title="Deploy emergency parachute — use only when crash is imminent"
                      >
                        <ArrowDownToLine size={14} />
                        ⛑️ Deploy Parachute
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 9.5, color: 'rgba(255,255,255,0.3)' }}>
                      <Info size={9} />
                      RTB aborts mission &amp; re-routes safely. Parachute is irreversible — drone halts immediately.
                    </div>
                  </div>
                )}



                {/* Parachuted state info */}
                {isParachuted && (
                  <div style={{
                    padding: '12px 14px', borderRadius: 10, marginBottom: 12,
                    background: 'rgba(255, 61, 87, 0.06)',
                    border: '1px solid rgba(255, 61, 87, 0.4)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 20 }}>⛑️</span>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--brand-danger)', marginBottom: 2 }}>
                          Parachute Deployed — Recovery in Progress
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Motors halted · Airframe descending at deploy site</div>
                      </div>
                    </div>

                    {/* Deploy Coordinates */}
                    <div style={{
                      padding: '10px 14px', borderRadius: 8,
                      background: 'rgba(5, 12, 24, 0.8)',
                      border: '1px solid rgba(255, 61, 87, 0.35)',
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
                        📍 Deploy Site Coordinates
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 15, fontWeight: 900,
                          color: 'var(--brand-danger)',
                          fontFamily: 'JetBrains Mono, monospace',
                          letterSpacing: '0.5px',
                        }}>
                          {drone.lat?.toFixed(5) ?? '—'}, {drone.lng?.toFixed(5) ?? '—'}
                        </span>
                        <span style={{ fontSize: 9.5, color: '#555' }}>Lat, Lng (WGS84)</span>
                      </div>
                      {drone.altitude_m != null && (
                        <div style={{ fontSize: 10.5, color: '#555', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
                          Alt at deploy: <span style={{ color: '#888' }}>{drone.altitude_m?.toFixed(0)} m</span>
                          &nbsp;·&nbsp;Battery: <span style={{ color: 'var(--brand-danger)' }}>{drone.battery_pct?.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── BOTTOM ROW: 3D Tracking & Delete ── */}
                <div style={{
                  display: 'flex', gap: 8,
                  paddingTop: 10,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (onTrackIn3D) onTrackIn3D(drone.id);
                      else onTrackOnMap?.(drone.id);
                    }}
                    id={`btn-3d-${drone.id}`}
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      background: 'rgba(6, 255, 165, 0.10)',
                      border: '1px solid rgba(6, 255, 165, 0.45)',
                      color: 'var(--brand-accent)',
                      fontSize: 11, fontWeight: 800, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      borderRadius: 6, padding: '8px 14px',
                      boxShadow: '0 0 10px rgba(6, 255, 165, 0.12)',
                    }}
                    title={`Open Google Photorealistic 3D tracking view for ${drone.id}`}
                  >
                    🌐 GOOGLE 3D VIEW
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDroneToDelete(drone.id);
                      setDeleteSecretCode('');
                    }}
                    id={`btn-delete-${drone.id}`}
                    className="btn btn-ghost btn-sm"
                    style={{
                      padding: '8px 14px',
                      color: 'var(--brand-danger)',
                      borderColor: 'rgba(255, 61, 87, 0.4)',
                      background: 'rgba(255, 61, 87, 0.08)',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    title={`Decommission ${drone.id} (Requires Secret Code)`}
                  >
                    <Trash2 size={13} /> Delete
                  </button>

                  {drone.payload_weight_kg && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 12px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      fontSize: 10.5, color: 'var(--text-muted)',
                    }}>
                      <Package size={10} />
                      {drone.payload_weight_kg?.toFixed(1)} kg cargo
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          padding: 48, textAlign: 'center', borderRadius: 12,
          background: 'rgba(8, 16, 33, 0.6)',
          border: '1px dashed rgba(0, 212, 255, 0.2)',
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🛰️</div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            No Matching Drones Found
          </h3>
          <p style={{ margin: '0 auto 16px', maxWidth: 400, fontSize: 12, color: 'var(--text-secondary)' }}>
            No airframes currently match your filter criteria or search query.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => { setStatusFilter('ALL'); setSearchQuery(''); }}>
              Reset Filters
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onGoToDispatch}>
              <Send size={12} style={{ marginRight: 4 }} /> Go to Mission Dispatch
            </button>
          </div>
        </div>
      )}

      {/* ── DECOMMISSION MODAL ── */}
      {droneToDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
        }}>
          <form onSubmit={handleConfirmDecommission} style={{
            width: 380, padding: 22,
            background: 'rgba(8, 16, 33, 0.98)',
            border: '1px solid rgba(255, 61, 87, 0.45)',
            borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.85)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔐</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--brand-danger)', textTransform: 'uppercase' }}>Authorize Decommission</span>
              </div>
              <button type="button" onClick={() => setDroneToDelete(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={15} />
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: '1.5' }}>
              Decommissioning <strong style={{ color: '#fff' }}>{droneToDelete}</strong> from active fleet. Enter the secret authorization code:
            </p>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Lock size={11} color="var(--brand-primary)" /> Secret Authorization Code
              </label>
              <input
                type="password" className="form-input"
                placeholder="Enter secret authorization code"
                value={deleteSecretCode}
                onChange={e => setDeleteSecretCode(e.target.value)}
                autoFocus required
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDroneToDelete(null)}>Cancel</button>
              <button type="submit" className="btn btn-sm"
                style={{ background: 'var(--brand-danger)', color: '#fff', border: 'none', fontWeight: 800, cursor: deleteLoading ? 'not-allowed' : 'pointer', padding: '7px 16px', borderRadius: 6 }}
                disabled={deleteLoading}>
                {deleteLoading ? 'Verifying...' : 'Confirm Decommission'}
              </button>
            </div>
          </form>
        </div>
      )}


      {/* ── EMERGENCY ACTION CONFIRMATION MODAL ── */}
      {emergencyModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
          backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300,
        }}>
          <div style={{
            width: 440, padding: 26,
            background: 'rgba(8, 14, 28, 0.99)',
            border: emergencyModal.type === 'parachute'
              ? '1.5px solid rgba(255, 61, 87, 0.65)'
              : '1.5px solid rgba(251, 191, 36, 0.6)',
            borderRadius: 14,
            boxShadow: emergencyModal.type === 'parachute'
              ? '0 0 50px rgba(255,61,87,0.3), 0 20px 50px rgba(0,0,0,0.9)'
              : '0 0 40px rgba(251,191,36,0.2), 0 20px 50px rgba(0,0,0,0.9)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  background: emergencyModal.type === 'parachute' ? 'rgba(255,61,87,0.12)' : 'rgba(251,191,36,0.12)',
                  border: emergencyModal.type === 'parachute' ? '1px solid rgba(255,61,87,0.4)' : '1px solid rgba(251,191,36,0.4)',
                }}>
                  {emergencyModal.type === 'parachute' ? '⛑️' : '🏠'}
                </div>
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px',
                    color: emergencyModal.type === 'parachute' ? 'var(--brand-danger)' : 'var(--brand-warning)',
                  }}>
                    {emergencyModal.type === 'parachute' ? '⚠️ Deploy Emergency Parachute' : '⚠️ Emergency Return to Base'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Airframe: <strong style={{ color: '#fff' }}>{emergencyModal.droneId}</strong>
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setEmergencyModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            {/* Warning content */}
            <div style={{
              padding: '12px 14px', borderRadius: 8, marginBottom: 18,
              background: emergencyModal.type === 'parachute' ? 'rgba(255,61,87,0.07)' : 'rgba(251,191,36,0.07)',
              border: emergencyModal.type === 'parachute' ? '1px solid rgba(255,61,87,0.25)' : '1px solid rgba(251,191,36,0.25)',
            }}>
              {emergencyModal.type === 'rtb' ? (
                <>
                  <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, marginBottom: 6 }}>
                    This will immediately abort the active delivery mission and reroute {emergencyModal.droneId} back to MMR Central Hub via A* safe path.
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    • Active order <strong style={{ color: 'var(--brand-accent)' }}>{emergencyModal.drone?.order_id}</strong> will be marked as ABORTED<br />
                    • Drone will be re-routed around all No-Fly Zones via A* algorithm<br />
                    • Payload will be dropped at current position<br />
                    • Drone will return to STANDBY upon arriving at hub
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, marginBottom: 6 }}>
                    ⚠️ This is an IRREVERSIBLE action. Deploying parachute will immediately halt all propulsion.
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    • Drone motors will cut off instantly — no controlled landing<br />
                    • Emergency parachute deploys and drone descends at current position<br />
                    • Active order <strong style={{ color: 'var(--brand-danger)' }}>{emergencyModal.drone?.order_id}</strong> will be marked as PARACHUTE_ABORT<br />
                    • Physical recovery team must be dispatched to retrieve airframe<br />
                    • Use only if crash or collision is imminent
                  </div>
                </>
              )}
            </div>

            {/* Drone current state */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8,
              padding: '8px 12px', borderRadius: 8, marginBottom: 18,
              background: 'rgba(5,12,24,0.6)', border: '1px solid var(--border-subtle)',
              textAlign: 'center',
            }}>
              {[
                { label: 'Battery', value: `${emergencyModal.drone?.battery_pct?.toFixed(0) ?? '?'}%` },
                { label: 'Altitude', value: `${emergencyModal.drone?.altitude_m?.toFixed(0) ?? '?'} m` },
                { label: 'FSI', value: `${emergencyModal.drone?.fsi?.toFixed(0) ?? '?'}%` },
              ].map((item, i) => (
                <div key={i}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => setEmergencyModal(null)}
                style={{ flex: 1, padding: '10px', fontWeight: 700 }}
                disabled={emergencyLoading}>
                Cancel — Keep Flying
              </button>
              <button
                type="button"
                onClick={emergencyModal.type === 'rtb' ? handleEmergencyRTB : handleParachuteDeploy}
                disabled={emergencyLoading}
                style={{
                  flex: 1.5, padding: '10px 16px', borderRadius: 8, border: 'none',
                  background: emergencyModal.type === 'parachute'
                    ? 'linear-gradient(135deg, #ff3d57, #c51230)'
                    : 'linear-gradient(135deg, #fbbf24, #d97706)',
                  color: '#000',
                  fontSize: 12, fontWeight: 900, cursor: emergencyLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  letterSpacing: '0.4px',
                  opacity: emergencyLoading ? 0.7 : 1,
                }}>
                {emergencyLoading
                  ? 'Processing...'
                  : emergencyModal.type === 'rtb'
                  ? '🏠 Confirm Emergency RTB'
                  : '⛑️ Confirm Parachute Deploy'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ENLIST NEW DRONE MODAL ── */}
      {showAddDrone && (
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
            onSubmit={handleRegisterDrone}
            style={{
              width: 400,
              padding: 22,
              background: 'rgba(8, 16, 33, 0.98)',
              border: '1px solid rgba(0, 212, 255, 0.35)',
              borderRadius: 12,
              boxShadow: '0 20px 50px rgba(0,0,0,0.85)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🚀</span>
                <span style={{ fontSize: 12.5, fontWeight: 900, color: 'var(--brand-primary)', textTransform: 'uppercase' }}>
                  Enlist New Drone to Mumbai Fleet
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDrone(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label className="form-label">Drone ID</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. BOM-AIR-08"
                value={newDroneId}
                onChange={e => setNewDroneId(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label className="form-label">Airframe Model</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. OctoCopter HeavyLifter"
                value={newDroneModel}
                onChange={e => setNewDroneModel(e.target.value)}
                required
              />
            </div>

            {/* 3-Column Specs: Payload, Battery, Max Speed */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}>Payload (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="15.0"
                  className="form-input"
                  value={newDronePayload}
                  onChange={e => setNewDronePayload(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}>Battery (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="form-input"
                  value={newDroneBattery}
                  onChange={e => setNewDroneBattery(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}>Max Speed</label>
                <input
                  type="number"
                  min="20"
                  max="160"
                  className="form-input"
                  placeholder="km/h"
                  value={newDroneSpeed}
                  onChange={e => setNewDroneSpeed(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Secret Authorization Code Field */}
            <div style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Lock size={11} color="var(--brand-warning)" /> Decommission Secret Code
                </span>
                <span style={{ fontSize: 9.5, color: 'var(--brand-warning)', fontWeight: 700 }}>*Required to Delete</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 8421 or SEC-ALPHA"
                value={newDroneSecretCode}
                onChange={e => setNewDroneSecretCode(e.target.value)}
                required
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                🔒 This code is saved in MongoDB and is strictly required to decommission this drone.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAddDrone(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={addLoading}
              >
                {addLoading ? 'Enlisting...' : 'Register Airframe'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
