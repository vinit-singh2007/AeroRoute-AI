// AeroRoute — Clean & Focused Delivery Mission Dispatch Panel
import { useState, useEffect } from 'react';
import {
  Send,
  Navigation,
  Package,
  PlusCircle,
  Trash2,
  MapPin,
  X,
  FileText,
  RotateCw,
  Sparkles,
  Zap,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { addDrone, deleteDrone, dispatchMission, optimizeRoute, predictBattery } from '../services/api';
import { toast } from './Toast';

const MUMBAI_HUB = {
  id: 'hub-bkc',
  name: 'Mumbai Central Hub – BKC Logistics Base',
  lat: 19.0657,
  lng: 72.8687,
};

const MUMBAI_DESTINATIONS = [
  { id: 'MUM-1', name: 'Nariman Point / Marine Drive Hub', lat: 18.9256, lng: 72.8242 },
  { id: 'MUM-2', name: 'Andheri East Commercial Drop',    lat: 19.1136, lng: 72.8697 },
  { id: 'MUM-3', name: 'Powai Hiranandani Tech Delivery', lat: 19.1176, lng: 72.9060 },
  { id: 'MUM-4', name: 'Dadar Central Crossing Depot',     lat: 19.0178, lng: 72.8478 },
  { id: 'MUM-5', name: 'Navi Mumbai Vashi Terminal',      lat: 19.0770, lng: 72.9986 },
  { id: 'MUM-6', name: 'Borivali West Cargo Center',      lat: 19.2307, lng: 72.8567 },
  { id: 'CUSTOM', name: '📍 Custom Drop (Map Click / GPS Lat-Lng)', lat: null, lng: null },
];

export default function DispatchPanel({
  onRouteResult,
  mapPinnedDestination,
  drones = [],
  onRefreshFleet,
  onNavigateToPredictions,
  onNavigateToMissions,
}) {
  // Dispatcher & Order state
  const [dispatcherName,   setDispatcherName]   = useState('Agent Rohit Verma');
  const [orderId,          setOrderId]          = useState('ORD-MUM-8421');
  const [cargoPriority,    setCargoPriority]    = useState('EXPRESS');

  // Drone & Target state
  const [selectedDroneId,  setSelectedDroneId]  = useState('');
  const [destinationId,    setDestinationId]    = useState('MUM-1');
  const [customLat,        setCustomLat]        = useState('');
  const [customLng,        setCustomLng]        = useState('');
  const [payloadWeight,    setPayloadWeight]    = useState(1.8);
  const [dispatchLoading,  setDispatchLoading]  = useState(false);
  const [activeMission,    setActiveMission]    = useState(null);

  // New Drone Form Modal
  const [showAddDrone,     setShowAddDrone]     = useState(false);
  const [newDroneId,       setNewDroneId]       = useState('');
  const [newDroneModel,    setNewDroneModel]    = useState('OctoCopter HeavyLifter');
  const [newDronePayload,  setNewDronePayload]  = useState(4.5);
  const [newDroneBattery,  setNewDroneBattery]  = useState(100);
  const [addLoading,       setAddLoading]       = useState(false);

  // Auto-select first drone if not selected
  useEffect(() => {
    if (drones.length > 0 && (!selectedDroneId || !drones.find(d => d.id === selectedDroneId))) {
      setSelectedDroneId(drones[0].id);
    }
  }, [drones, selectedDroneId]);

  // Sync when user clicks anywhere on map
  useEffect(() => {
    if (mapPinnedDestination) {
      setDestinationId('CUSTOM');
      setCustomLat(mapPinnedDestination.lat.toFixed(5));
      setCustomLng(mapPinnedDestination.lng.toFixed(5));
      toast(`Pinned GPS Target: ${mapPinnedDestination.lat.toFixed(4)}, ${mapPinnedDestination.lng.toFixed(4)}`, 'info');
    }
  }, [mapPinnedDestination]);

  const generateNewOrderId = () => {
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    setOrderId(`ORD-MUM-${randomCode}`);
  };

  // Compute resolved target
  const getResolvedDestination = () => {
    if (destinationId === 'CUSTOM') {
      const lat = parseFloat(customLat);
      const lng = parseFloat(customLng);
      if (isNaN(lat) || isNaN(lng)) return null;
      return { lat, lng, name: `Custom Pin (${lat.toFixed(3)}, ${lng.toFixed(3)})` };
    }
    return MUMBAI_DESTINATIONS.find(d => d.id === destinationId);
  };

  // Haversine distance calculator (BKC Hub to Target)
  const calcDistanceKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 10.0;
    const R = 6371.0;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const resolvedDest = getResolvedDestination();
  const selectedDrone = drones.find(d => d.id === selectedDroneId) || drones[0] || { id: 'BOM-001', max_payload_kg: 4.0, battery_pct: 100 };
  const flightDistanceKm = resolvedDest && resolvedDest.lat && resolvedDest.lng
    ? calcDistanceKm(MUMBAI_HUB.lat, MUMBAI_HUB.lng, resolvedDest.lat, resolvedDest.lng)
    : 10.0;

  // AI Predicted Battery Drain calculation
  const predictedDrainPct = Math.min(95, Math.round(flightDistanceKm * (1.1 + payloadWeight * 0.38) + 4.5));
  const currentBattery = selectedDrone?.battery_pct !== undefined ? selectedDrone.battery_pct : 100;
  const remainingBatteryOnArrival = Math.max(0, Math.round(currentBattery - predictedDrainPct));

  // Overweight Check
  const maxPayload = selectedDrone?.max_payload_kg || 4.0;
  const isOverweight = payloadWeight > maxPayload;

  // Battery Safety Margin Check
  const isBatteryCritical = remainingBatteryOnArrival < 20 || currentBattery < (predictedDrainPct + 10);
  const isBatteryTight = !isBatteryCritical && remainingBatteryOnArrival < 35;

  // Pre-Flight AI Verdict
  let aiVerdict = 'SAFE';
  let aiVerdictLabel = '✅ DISPATCH APPROVED — SAFE FLIGHT';
  let aiVerdictColor = 'var(--brand-accent)';
  let aiVerdictBg = 'rgba(6,255,165,0.07)';
  let aiVerdictBorder = 'rgba(6,255,165,0.3)';
  let aiVerdictMessage = `AI validated: Safe payload ratio (${((payloadWeight/maxPayload)*100).toFixed(0)}%) & healthy ${remainingBatteryOnArrival}% battery reserve upon arrival.`;

  if (isOverweight) {
    aiVerdict = 'OVERWEIGHT';
    aiVerdictLabel = '⛔ BLOCKED: CARGO OVERWEIGHT';
    aiVerdictColor = 'var(--brand-danger)';
    aiVerdictBg = 'rgba(255,61,87,0.1)';
    aiVerdictBorder = 'rgba(255,61,87,0.4)';
    aiVerdictMessage = `Package mass (${payloadWeight.toFixed(1)} kg) exceeds ${selectedDrone.id} limit (${maxPayload.toFixed(1)} kg). Choose a heavier drone or reduce mass.`;
  } else if (isBatteryCritical) {
    aiVerdict = 'CRITICAL_BATTERY';
    aiVerdictLabel = '⚠️ UNSAFE: INSUFFICIENT CHARGE';
    aiVerdictColor = 'var(--brand-danger)';
    aiVerdictBg = 'rgba(255,61,87,0.1)';
    aiVerdictBorder = 'rgba(255,61,87,0.4)';
    aiVerdictMessage = `Current battery (${currentBattery.toFixed(0)}%) too low for ${flightDistanceKm.toFixed(1)} km delivery. Predicted drain ${predictedDrainPct}% leaves only ${remainingBatteryOnArrival}%. Need >= ${(predictedDrainPct + 20)}% charge.`;
  } else if (isBatteryTight) {
    aiVerdict = 'CAUTION';
    aiVerdictLabel = '⚡ CAUTION: TIGHT RESERVE MARGIN';
    aiVerdictColor = 'var(--brand-warning)';
    aiVerdictBg = 'rgba(251,191,36,0.1)';
    aiVerdictBorder = 'rgba(251,191,36,0.4)';
    aiVerdictMessage = `Mission feasible but leaves tight ${remainingBatteryOnArrival}% reserve upon delivery. Drone should RTB immediately post-drop.`;
  }

  // 1. Add Drone to Fleet
  const handleRegisterDrone = async (e) => {
    e.preventDefault();
    if (!newDroneId.trim()) {
      toast('Please enter a unique Drone ID (e.g. BOM-AIR-05)', 'warning');
      return;
    }
    setAddLoading(true);
    try {
      await addDrone({
        id: newDroneId.trim().toUpperCase(),
        model: newDroneModel.trim(),
        max_payload_kg: parseFloat(newDronePayload),
        battery_pct: parseFloat(newDroneBattery),
      });
      toast(`Drone ${newDroneId.toUpperCase()} registered to Mumbai Fleet!`, 'success');
      setSelectedDroneId(newDroneId.trim().toUpperCase());
      setNewDroneId('');
      setShowAddDrone(false);
      onRefreshFleet?.();
    } catch (err) {
      toast(`Failed to register drone: ${err.message}`, 'error');
    } finally {
      setAddLoading(false);
    }
  };

  // 2. Delete Drone from Fleet
  const handleDeleteDrone = async (droneId) => {
    if (drones.length <= 1) {
      toast('At least one drone must remain active in the fleet', 'warning');
      return;
    }
    try {
      await deleteDrone(droneId);
      toast(`Drone ${droneId} decommissioned from fleet`, 'info');
      onRefreshFleet?.();
    } catch (err) {
      toast(`Failed to remove drone: ${err.message}`, 'error');
    }
  };

  // 3. Final Dispatch: Assign Order to Drone & Launch
  const handleAssignAndDispatch = async () => {
    const dest = getResolvedDestination();
    if (!dest) {
      toast('Please set a valid delivery destination', 'error');
      return;
    }
    if (!selectedDroneId) {
      toast('Please select an active drone from your fleet', 'error');
      return;
    }

    setDispatchLoading(true);
    try {
      // Automatic GA route solve in background for map rendering
      const route = await optimizeRoute({
        origin:               { lat: MUMBAI_HUB.lat, lng: MUMBAI_HUB.lng },
        destination:          { lat: dest.lat,       lng: dest.lng       },
        payload_weight_kg:    payloadWeight,
        wind_speed_ms:        5.0,
        max_battery_drain_pct: 80.0,
        intermediate_stops:   [],
      });
      onRouteResult?.(route);

      // Dispatch mission to backend
      await dispatchMission({
        drone_id: selectedDroneId,
        destination: { lat: dest.lat, lng: dest.lng },
        destination_name: dest.name,
        order_id: orderId,
        agent_name: dispatcherName,
        payload_weight_kg: payloadWeight,
      });

      setActiveMission({
        orderId,
        droneId: selectedDroneId,
        destinationName: dest.name,
        agent: dispatcherName,
        payload: payloadWeight,
        timestamp: new Date().toLocaleTimeString(),
      });

      toast(`🚀 Order ${orderId} Assigned to ${selectedDroneId}! En route to ${dest.name}`, 'success');
      generateNewOrderId();
    } catch (err) {
      toast(`Dispatch assignment failed: ${err.message}`, 'error');
    } finally {
      setDispatchLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* ── SECTION 1: Delivery Order & Dispatcher Info ── */}
      <div className="panel-section">
        <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={12} /> Delivery Assignment
          </span>
          <span style={{ fontSize: 9, color: 'var(--brand-primary)', background: 'rgba(0,212,255,0.1)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
            Mumbai Hub
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <label className="form-label">Delivery Agent</label>
            <input
              type="text"
              className="form-input"
              value={dispatcherName}
              onChange={e => setDispatcherName(e.target.value)}
              placeholder="Agent Name"
            />
          </div>
          <div>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Order ID</span>
              <RotateCw size={10} style={{ cursor: 'pointer', color: 'var(--brand-primary)' }} onClick={generateNewOrderId} title="Generate new order code" />
            </label>
            <input
              type="text"
              className="form-input"
              value={orderId}
              onChange={e => setOrderId(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="form-label">Priority</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[
              { id: 'STANDARD', label: 'Standard', color: 'var(--text-secondary)' },
              { id: 'EXPRESS',  label: '⚡ Express', color: 'var(--brand-primary)' },
              { id: 'MEDICAL',  label: '🚑 Medical', color: 'var(--brand-danger)' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setCargoPriority(p.id)}
                style={{
                  padding: '5px 4px',
                  borderRadius: 6,
                  border: cargoPriority === p.id ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                  background: cargoPriority === p.id ? 'rgba(0,212,255,0.15)' : 'rgba(8,15,31,0.6)',
                  color: cargoPriority === p.id ? p.color : 'var(--text-muted)',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Drone Selection & Fleet Addition ── */}
      <div className="panel-section">
        <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Navigation size={12} /> Assign Drone ({drones.length} active)
          </span>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '2px 8px', fontSize: 10, borderColor: 'rgba(0,212,255,0.4)', color: 'var(--brand-primary)' }}
            onClick={() => setShowAddDrone(!showAddDrone)}
            id="toggle-add-drone-btn"
          >
            <PlusCircle size={10} /> + Add Drone
          </button>
        </div>

        {/* Dynamic Add Drone Form Modal */}
        {showAddDrone && (
          <form
            onSubmit={handleRegisterDrone}
            style={{
              padding: 12,
              background: 'rgba(0,212,255,0.06)',
              border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Deploy New Drone
              </span>
              <button
                type="button"
                onClick={() => setShowAddDrone(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label className="form-label">Drone ID</label>
                <input
                  type="text"
                  placeholder="e.g. BOM-AIR-09"
                  className="form-input"
                  value={newDroneId}
                  onChange={e => setNewDroneId(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label">Model Name</label>
                <input
                  type="text"
                  placeholder="OctoCopter Pro"
                  className="form-input"
                  value={newDroneModel}
                  onChange={e => setNewDroneModel(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label className="form-label">Max Payload (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="10.0"
                  className="form-input"
                  value={newDronePayload}
                  onChange={e => setNewDronePayload(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Battery %</label>
                <input
                  type="number"
                  min="20"
                  max="100"
                  className="form-input"
                  value={newDroneBattery}
                  onChange={e => setNewDroneBattery(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={addLoading}
              className="btn btn-primary btn-full btn-sm"
            >
              {addLoading ? 'Registering…' : 'Enlist in Fleet'}
            </button>
          </form>
        )}

        {/* Selected Drone Dropdown */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <select
            className="form-select"
            value={selectedDroneId}
            onChange={e => setSelectedDroneId(e.target.value)}
            id="drone-select"
            style={{ flex: 1 }}
          >
            {drones.map(d => (
              <option key={d.id} value={d.id}>
                {d.id} — {d.model} ({d.battery_pct?.toFixed(0)}% Bat)
              </option>
            ))}
          </select>
          {drones.length > 1 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title="Decommission selected drone"
              onClick={() => handleDeleteDrone(selectedDroneId)}
              style={{ padding: '0 10px', color: 'var(--brand-danger)', borderColor: 'rgba(255,61,87,0.3)' }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Selected Drone Ribbon */}
        {selectedDrone && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 6,
            background: 'rgba(8,15,31,0.6)',
            border: '1px solid var(--border-subtle)',
            fontSize: 10,
          }}>
            <span style={{ color: 'var(--text-muted)' }}>ID: <strong style={{ color: 'var(--text-primary)' }}>{selectedDrone.id}</strong></span>
            <span style={{ color: 'var(--text-muted)' }}>Capacity: <strong style={{ color: 'var(--brand-primary)' }}>{selectedDrone.max_payload_kg} kg</strong></span>
            <span style={{ color: 'var(--text-muted)' }}>Battery: <strong style={{ color: 'var(--brand-accent)' }}>{selectedDrone.battery_pct?.toFixed(0)}%</strong></span>
          </div>
        )}
      </div>

      {/* ── SECTION 3: Destination & Cargo ── */}
      <div className="panel-section">
        <div className="panel-title"><MapPin size={12} /> Assign Destination</div>

        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="form-label">Drop Location</label>
          <select
            className="form-select"
            value={destinationId}
            onChange={e => setDestinationId(e.target.value)}
            id="destination-select"
          >
            {MUMBAI_DESTINATIONS.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <div style={{ fontSize: 10, color: 'var(--brand-primary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={10} /> Tip: Click anywhere on the Mumbai map to pin exact customer GPS!
          </div>
        </div>

        {/* Custom Coordinates Inputs if selected */}
        {destinationId === 'CUSTOM' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 8,
            padding: 8,
            background: 'rgba(6,255,165,0.05)',
            border: '1px solid rgba(6,255,165,0.2)',
            borderRadius: 6,
          }}>
            <div>
              <label className="form-label">Latitude</label>
              <input
                type="number"
                step="0.0001"
                placeholder="19.0760"
                className="form-input"
                value={customLat}
                onChange={e => setCustomLat(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Longitude</label>
              <input
                type="number"
                step="0.0001"
                placeholder="72.8777"
                className="form-input"
                value={customLng}
                onChange={e => setCustomLng(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Cargo Weight Range */}
        <div className="form-group" style={{ marginBottom: 4 }}>
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><Package size={10} style={{ marginRight: 4 }} />Package Mass</span>
            <span className="text-mono" style={{ color: 'var(--brand-primary)' }}>{payloadWeight.toFixed(1)} kg</span>
          </label>
          <input
            type="range"
            className="form-range"
            min={0.1}
            max={selectedDrone?.max_payload_kg || 5.0}
            step={0.1}
            value={payloadWeight}
            onChange={e => setPayloadWeight(parseFloat(e.target.value))}
            id="payload-weight-range"
          />
        </div>
      </div>

      {/* ── SECTION 4: AI Pre-Flight Feasibility & Safety Check ── */}
      <div className="panel-section" style={{
        background: aiVerdictBg,
        border: `1px solid ${aiVerdictBorder}`,
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 10,
        boxShadow: `0 0 16px ${aiVerdictBorder}`,
        transition: 'all 200ms ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={13} color={aiVerdictColor} />
            <span style={{ fontSize: 11, fontWeight: 800, color: aiVerdictColor, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              AI Pre-Flight Safety Check
            </span>
          </div>
          <span style={{
            fontSize: 9.5,
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: 6,
            background: aiVerdictBg,
            color: aiVerdictColor,
            border: `1px solid ${aiVerdictBorder}`,
          }}>
            {aiVerdict}
          </span>
        </div>

        {/* 4 Metric Badges: Distance, AI Battery Drain, Reserve on Arrival, Payload Ratio */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 4px', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>DISTANCE</div>
            <div className="text-mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-primary)' }}>
              {flightDistanceKm.toFixed(1)} km
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 4px', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>PRED. DRAIN</div>
            <div className="text-mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-secondary)' }}>
              ~{predictedDrainPct}%
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 4px', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>ON ARRIVAL</div>
            <div className="text-mono" style={{
              fontSize: 11,
              fontWeight: 800,
              color: remainingBatteryOnArrival < 20 ? 'var(--brand-danger)' : remainingBatteryOnArrival < 35 ? 'var(--brand-warning)' : 'var(--brand-accent)'
            }}>
              {remainingBatteryOnArrival}%
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 4px', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>PAYLOAD</div>
            <div className="text-mono" style={{
              fontSize: 11,
              fontWeight: 800,
              color: isOverweight ? 'var(--brand-danger)' : 'var(--brand-accent)'
            }}>
              {payloadWeight.toFixed(1)}/{maxPayload.toFixed(0)}k
            </div>
          </div>
        </div>

        {/* AI Verdict Message Box */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          fontSize: 10.5,
          lineHeight: '1.4',
          color: aiVerdictColor,
          padding: '8px 10px',
          borderRadius: 6,
          background: 'rgba(0,0,0,0.35)',
        }}>
          {isOverweight ? (
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          ) : isBatteryCritical ? (
            <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          ) : isBatteryTight ? (
            <Zap size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          ) : (
            <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          )}
          <div>
            <strong>{aiVerdictLabel}</strong>
            <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 2 }}>
              {aiVerdictMessage}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 5: Dispatch Action Button ── */}
      <div className="panel-section" style={{ background: 'rgba(0, 212, 255, 0.04)' }}>
        <button
          className={`btn btn-primary btn-full ${dispatchLoading ? 'btn-loading' : ''}`}
          onClick={() => {
            if (isOverweight) {
              toast(`⚠️ Cannot dispatch: Payload exceeds ${selectedDrone.id} limit!`, 'error');
              return;
            }
            if (isBatteryCritical) {
              toast(`⚠️ Cannot dispatch: Battery charge (${currentBattery.toFixed(0)}%) too low for this route!`, 'error');
              return;
            }
            handleAssignAndDispatch();
          }}
          disabled={dispatchLoading || isOverweight || isBatteryCritical}
          style={{
            padding: '12px',
            fontSize: 13,
            boxShadow: isOverweight || isBatteryCritical
              ? 'none'
              : '0 4px 20px rgba(0,212,255,0.4)',
            opacity: (isOverweight || isBatteryCritical) ? 0.5 : 1,
            cursor: (isOverweight || isBatteryCritical) ? 'not-allowed' : 'pointer',
          }}
          id="dispatch-mission-btn"
        >
          {!dispatchLoading && <Send size={15} />}
          {dispatchLoading
            ? 'Assigning & Launching…'
            : isOverweight
            ? '⛔ Blocked: Cargo Overweight'
            : isBatteryCritical
            ? '⚠️ Blocked: Battery Too Low'
            : '🚀 Launch Delivery Mission'}
        </button>

        {/* Active Mission Banner */}
        {activeMission && (
          <div style={{
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(6,255,165,0.08)',
            border: '1px solid rgba(6,255,165,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand-accent)' }}>
                ✓ MISSION EN ROUTE
              </span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{activeMission.timestamp}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)', marginBottom: 2 }}>
              <strong>{activeMission.droneId}</strong> assigned to Order <strong>{activeMission.orderId}</strong>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              Target: {activeMission.destinationName} • Agent: {activeMission.agent}
            </div>
          </div>
        )}

        {/* Link to Dedicated Live Missions & Delivery Logs Hub */}
        <div style={{
          marginTop: 12,
          paddingTop: 8,
          borderTop: '1px solid var(--border-subtle)',
          textAlign: 'center'
        }}>
          <button
            type="button"
            onClick={onNavigateToMissions || onNavigateToPredictions}
            id="view-live-missions-btn"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--brand-primary)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Package size={13} /> View Live Missions & Delivery Logs →
          </button>
        </div>
      </div>

    </div>
  );
}
