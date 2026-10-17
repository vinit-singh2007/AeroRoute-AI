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
  AlertTriangle,
  Bot,
  RefreshCw
} from 'lucide-react';
import { addDrone, deleteDrone, deleteAllDrones, dispatchMission, optimizeRoute, predictBattery, checkPreFlightSafety } from '../services/api';
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

  // LLM Pre-Flight Safety Advisor State
  const [llmResult,        setLlmResult]        = useState(null);
  const [llmLoading,       setLlmLoading]       = useState(false);

  // Auto-select first drone if not selected, or clear selection if fleet is empty
  useEffect(() => {
    if (drones.length > 0) {
      if (!selectedDroneId || !drones.find(d => d.id === selectedDroneId)) {
        setSelectedDroneId(drones[0].id);
      }
    } else {
      if (selectedDroneId) {
        setSelectedDroneId('');
      }
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
  const selectedDrone = drones.find(d => d.id === selectedDroneId) || (drones.length > 0 ? drones[0] : null);
  const flightDistanceKm = resolvedDest && resolvedDest.lat && resolvedDest.lng
    ? calcDistanceKm(MUMBAI_HUB.lat, MUMBAI_HUB.lng, resolvedDest.lat, resolvedDest.lng)
    : 10.0;

  // AI Predicted Battery Drain calculation
  const predictedDrainPct = Math.min(95, Math.round(flightDistanceKm * (1.1 + payloadWeight * 0.38) + 4.5));
  const currentBattery = selectedDrone?.battery_pct !== undefined ? selectedDrone.battery_pct : 0;
  const remainingBatteryOnArrival = selectedDrone ? Math.max(0, Math.round(currentBattery - predictedDrainPct)) : 0;

  // Overweight Check
  const maxPayload = selectedDrone?.max_payload_kg || 4.0;
  const isOverweight = selectedDrone ? (payloadWeight > maxPayload) : false;

  // Battery Safety Margin Check
  const isBatteryCritical = selectedDrone ? (remainingBatteryOnArrival < 20 || currentBattery < (predictedDrainPct + 10)) : false;
  const isBatteryTight = !isBatteryCritical && remainingBatteryOnArrival < 35;

  // Call LLM Pre-Flight Safety Advisor
  const fetchLlmSafetyCheck = async () => {
    if (!selectedDrone || drones.length === 0) return;
    setLlmLoading(true);
    try {
      const dest = getResolvedDestination();
      const res = await checkPreFlightSafety({
        drone_id: selectedDrone.id,
        drone_model: selectedDrone.model || 'Phantom-Mumbai X7',
        current_battery_pct: currentBattery,
        max_payload_kg: maxPayload,
        payload_weight_kg: payloadWeight,
        flight_distance_km: flightDistanceKm,
        predicted_drain_pct: predictedDrainPct,
        remaining_battery_pct: remainingBatteryOnArrival,
        destination_name: dest?.name || 'Customer Location',
        wind_gust_ms: 5.5,
      });
      setLlmResult(res);
    } catch (err) {
      console.warn('LLM safety check error:', err);
    } finally {
      setLlmLoading(false);
    }
  };

  // Debounced real-time LLM evaluation on parameter changes
  useEffect(() => {
    if (!selectedDrone || drones.length === 0) {
      setLlmResult(null);
      return;
    }
    const timer = setTimeout(() => {
      fetchLlmSafetyCheck();
    }, 380);
    return () => clearTimeout(timer);
  }, [selectedDroneId, payloadWeight, destinationId, customLat, customLng, currentBattery]);

  // Combined AI & LLM Verdict
  const isLlmBlocked = llmResult?.verdict === 'BLOCKED';
  const isLlmCaution = llmResult?.verdict === 'CAUTION';

  const isBlocked = isOverweight || isBatteryCritical || isLlmBlocked;
  const isCaution = !isBlocked && (isBatteryTight || isLlmCaution);

  const aiVerdict = isBlocked ? (isOverweight ? 'OVERWEIGHT' : 'BLOCKED') : (isCaution ? 'CAUTION' : 'SAFE');
  const aiVerdictColor = isBlocked ? 'var(--brand-danger)' : (isCaution ? 'var(--brand-warning)' : 'var(--brand-accent)');
  const aiVerdictBg = isBlocked ? 'rgba(255,61,87,0.1)' : (isCaution ? 'rgba(251,191,36,0.1)' : 'rgba(6,255,165,0.07)');
  const aiVerdictBorder = isBlocked ? 'rgba(255,61,87,0.4)' : (isCaution ? 'rgba(251,191,36,0.4)' : 'rgba(6,255,165,0.3)');

  const aiVerdictLabel = llmResult?.status_label || (
    isOverweight ? '⛔ BLOCKED: CARGO OVERWEIGHT' :
    isBatteryCritical ? '⚠️ UNSAFE: INSUFFICIENT CHARGE' :
    isBatteryTight ? '⚡ CAUTION: TIGHT RESERVE MARGIN' :
    '✅ DISPATCH APPROVED — SAFE FLIGHT'
  );

  const aiVerdictMessage = llmResult?.analysis || (
    isOverweight ? `Package mass (${payloadWeight.toFixed(1)} kg) exceeds ${selectedDrone.id} limit (${maxPayload.toFixed(1)} kg). Choose a heavier drone or reduce mass.` :
    isBatteryCritical ? `Current battery (${currentBattery.toFixed(0)}%) too low for ${flightDistanceKm.toFixed(1)} km delivery. Predicted drain ${predictedDrainPct}% leaves only ${remainingBatteryOnArrival}%. Need >= ${(predictedDrainPct + 20)}% charge.` :
    isBatteryTight ? `Mission feasible but leaves tight ${remainingBatteryOnArrival}% reserve upon delivery. Drone should RTB immediately post-drop.` :
    `AI validated: Safe payload ratio (${((payloadWeight/maxPayload)*100).toFixed(0)}%) & healthy ${remainingBatteryOnArrival}% battery reserve upon arrival.`
  );

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

  // 2. Delete Drone from Fleet (Allows deleting any drone including the last drone)
  const handleDeleteDrone = async (droneId) => {
    const idToDelete = droneId || selectedDroneId;
    if (!idToDelete) {
      toast('No drone selected to delete', 'warning');
      return;
    }
    try {
      await deleteDrone(idToDelete);
      toast(`Drone ${idToDelete} decommissioned from fleet`, 'info');
      if (selectedDroneId === idToDelete) {
        const remaining = drones.filter(d => d.id !== idToDelete);
        setSelectedDroneId(remaining.length > 0 ? remaining[0].id : '');
      }
      onRefreshFleet?.();
    } catch (err) {
      toast(`Failed to remove drone: ${err.message}`, 'error');
    }
  };

  // 2b. Delete All Drones from Fleet
  const handleDeleteAllDrones = async () => {
    if (!drones || drones.length === 0) {
      toast('Fleet is already empty', 'info');
      return;
    }
    try {
      await deleteAllDrones();
      setSelectedDroneId('');
      toast('All drones decommissioned from fleet', 'info');
      onRefreshFleet?.();
    } catch (err) {
      toast(`Failed to clear fleet: ${err.message}`, 'error');
    }
  };

  // 3. Final Dispatch: Assign Order to Drone & Launch
  const handleAssignAndDispatch = async () => {
    const dest = getResolvedDestination();
    if (!dest) {
      toast('Please set a valid delivery destination', 'error');
      return;
    }
    if (!selectedDroneId || drones.length === 0) {
      toast('Please enlist or select an active drone from your fleet', 'error');
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
          <div style={{ display: 'flex', gap: 6 }}>
            {drones.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 8px', fontSize: 10, borderColor: 'rgba(255,61,87,0.35)', color: 'var(--brand-danger)' }}
                onClick={handleDeleteAllDrones}
                title="Decommission all drones from fleet"
                id="delete-all-drones-btn"
              >
                <Trash2 size={10} /> Delete All
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 8px', fontSize: 10, borderColor: 'rgba(0,212,255,0.4)', color: 'var(--brand-primary)' }}
              onClick={() => setShowAddDrone(!showAddDrone)}
              id="toggle-add-drone-btn"
            >
              <PlusCircle size={10} /> + Add Drone
            </button>
          </div>
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

        {/* Selected Drone Dropdown / Empty State */}
        {drones.length > 0 ? (
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
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              title={`Decommission selected drone (${selectedDroneId})`}
              onClick={() => handleDeleteDrone(selectedDroneId)}
              style={{ padding: '0 10px', color: 'var(--brand-danger)', borderColor: 'rgba(255,61,87,0.3)' }}
              id="delete-drone-btn"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <div style={{
            padding: '12px',
            borderRadius: 6,
            background: 'rgba(255,61,87,0.06)',
            border: '1px dashed rgba(255,61,87,0.3)',
            textAlign: 'center',
            marginBottom: 8,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
              No active drones in the fleet
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddDrone(true)}
              id="empty-state-add-drone-btn"
            >
              <PlusCircle size={11} style={{ marginRight: 4 }} /> Add a Drone
            </button>
          </div>
        )}

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

      {/* ── SECTION 4: AI Pre-Flight Feasibility & Safety Check (LLM Powered) ── */}
      <div className="panel-section" style={{
        background: aiVerdictBg,
        border: `1px solid ${aiVerdictBorder}`,
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 10,
        boxShadow: `0 0 16px ${aiVerdictBorder}`,
        transition: 'all 200ms ease',
      }}>
        {/* Header with LLM Model Tag & Refresh Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={13} color={aiVerdictColor} />
            <span style={{ fontSize: 11, fontWeight: 800, color: aiVerdictColor, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              AI Pre-Flight Safety Check
            </span>
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 4,
              background: 'rgba(0, 212, 255, 0.12)',
              color: 'var(--brand-primary)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}>
              <Bot size={10} />
              {llmLoading ? 'Analyzing...' : (llmResult?.source === 'gemini-llm' ? '✨ Gemini 3.8 Flash' : llmResult?.source === 'groq-llm' ? '⚡ Groq Llama-3.3' : '✨ Gemini Safety AI')}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={fetchLlmSafetyCheck}
              title="Re-run LLM Flight Safety Evaluation"
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 6px', fontSize: 10, color: 'var(--text-muted)', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <RefreshCw size={10} className={llmLoading ? 'spin-anim' : ''} />
            </button>
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
          <div style={{ flex: 1 }}>
            <strong>{aiVerdictLabel}</strong>
            <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 2 }}>
              {aiVerdictMessage}
            </div>

            {/* LLM Key Risk Badges */}
            {llmResult?.key_risks && llmResult.key_risks.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {llmResult.key_risks.map((risk, idx) => (
                  <span key={idx} style={{
                    fontSize: 8.5,
                    padding: '2px 5px',
                    borderRadius: 4,
                    background: 'rgba(0,0,0,0.4)',
                    color: 'var(--text-secondary)',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    • {risk}
                  </span>
                ))}
              </div>
            )}

            {/* LLM Dispatcher Guidance */}
            {llmResult?.recommendation && (
              <div style={{
                marginTop: 6,
                padding: '5px 8px',
                borderRadius: 4,
                background: 'rgba(0, 212, 255, 0.06)',
                borderLeft: '2px solid var(--brand-primary)',
                fontSize: 9.5,
                color: 'var(--text-primary)',
              }}>
                <span style={{ color: 'var(--brand-primary)', fontWeight: 700, marginRight: 4 }}>
                  LLM Guidance:
                </span>
                {llmResult.recommendation}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 5: Dispatch Action Button ── */}
      <div className="panel-section" style={{ background: 'rgba(0, 212, 255, 0.04)' }}>
        <button
          className={`btn btn-primary btn-full ${dispatchLoading ? 'btn-loading' : ''}`}
          onClick={() => {
            if (!selectedDrone || drones.length === 0) {
              toast('⚠️ Cannot dispatch: No active drones in fleet! Please add a drone first.', 'error');
              return;
            }
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
          disabled={dispatchLoading || !selectedDrone || drones.length === 0 || isOverweight || isBatteryCritical}
          style={{
            padding: '12px',
            fontSize: 13,
            boxShadow: (!selectedDrone || drones.length === 0 || isOverweight || isBatteryCritical)
              ? 'none'
              : '0 4px 20px rgba(0,212,255,0.4)',
            opacity: (!selectedDrone || drones.length === 0 || isOverweight || isBatteryCritical) ? 0.5 : 1,
            cursor: (!selectedDrone || drones.length === 0 || isOverweight || isBatteryCritical) ? 'not-allowed' : 'pointer',
          }}
          id="dispatch-mission-btn"
        >
          {!dispatchLoading && <Send size={15} />}
          {dispatchLoading
            ? 'Assigning & Launching…'
            : !selectedDrone || drones.length === 0
            ? '⚠️ No Active Drones'
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
