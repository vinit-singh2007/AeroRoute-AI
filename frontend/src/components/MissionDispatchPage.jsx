// AeroRoute — Dedicated Full-Page Mission Dispatch Command Center (Midway Hub, Secret-Code Protected Decommission)
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
  RefreshCw,
  ArrowLeft,
  Check,
  Lock,
  Radio
} from 'lucide-react';
import {
  addDrone,
  deleteDrone,
  dispatchMission,
  optimizeRoute,
  checkPreFlightSafety
} from '../services/api';
import { toast } from './Toast';

// Central Hub relocated midway between Churchgate (~18.93) and Virar (~19.45)
const MUMBAI_HUB = {
  id: 'hub-mmr',
  name: 'AeroRoute Central Hub – MMR Midpoint (Kandivali/Goregaon)',
  lat: 19.1940,
  lng: 72.8550,
};

const MUMBAI_DESTINATIONS = [
  // ── North MMR Corridor (Virar, Nalasopara, Vasai, Mira-Bhayandar) ──
  { id: 'MUM-VIRAR',   name: 'Virar West Coastal Logistics Terminal',      lat: 19.4564, lng: 72.8081 },
  { id: 'MUM-NALA',    name: 'Nalasopara West Distribution Depot',         lat: 19.4182, lng: 72.8198 },
  { id: 'MUM-VASAI',   name: 'Vasai East Industrial Cargo Hub',           lat: 19.3812, lng: 72.8311 },
  { id: 'MUM-BHAY',    name: 'Bhayandar East Freight Depot',              lat: 19.2990, lng: 72.8550 },
  { id: 'MUM-MIRA',    name: 'Mira Road Express Commercial Drop',         lat: 19.2813, lng: 72.8561 },

  // ── Western Suburbs Corridor ──
  { id: 'MUM-BORIVALI',name: 'Borivali West Cargo Center',                 lat: 19.2307, lng: 72.8567 },
  { id: 'MUM-KANDIV',  name: 'Kandivali East Industrial Depot',           lat: 19.2062, lng: 72.8732 },
  { id: 'MUM-MALAD',   name: 'Malad West Mindspace Commercial Drop',      lat: 19.1860, lng: 72.8485 },
  { id: 'MUM-GOREG',   name: 'Goregaon East NESCO Exhibition Center',     lat: 19.1551, lng: 72.8526 },
  { id: 'MUM-ANDH-E',  name: 'Andheri East SEEPZ Cargo Depot',            lat: 19.1136, lng: 72.8697 },
  { id: 'MUM-ANDH-W',  name: 'Andheri West Lokhandwala Hub',              lat: 19.1362, lng: 72.8272 },
  { id: 'MUM-JUHU',    name: 'Juhu Tara Coastal Drop Point',              lat: 19.0988, lng: 72.8264 },
  { id: 'MUM-BANDRA',  name: 'Bandra West Pali Hill Delivery Hub',        lat: 19.0607, lng: 72.8277 },

  // ── Central Suburbs & Thane Corridor ──
  { id: 'MUM-THANE',   name: 'Thane West Wagle Estate Logistics Terminal', lat: 19.1944, lng: 72.9567 },
  { id: 'MUM-POWAI',   name: 'Powai Hiranandani Tech Delivery',           lat: 19.1176, lng: 72.9060 },
  { id: 'MUM-GHATK',   name: 'Ghatkopar East Metro Cargo Depot',          lat: 19.0856, lng: 72.9082 },
  { id: 'MUM-KURLA',   name: 'Kurla West Phoenix Marketcity Depot',       lat: 19.0860, lng: 72.8890 },
  { id: 'MUM-DADAR',   name: 'Dadar Central Crossing Depot',              lat: 19.0178, lng: 72.8478 },
  { id: 'MUM-LPAREL',  name: 'Lower Parel High Street Commercial Hub',    lat: 18.9950, lng: 72.8267 },

  // ── South Mumbai (Town) Corridor ──
  { id: 'MUM-NARIMAN', name: 'Nariman Point / Marine Drive Hub',          lat: 18.9256, lng: 72.8242 },
  { id: 'MUM-COLABA',  name: 'Colaba Causeway Commercial Depot',          lat: 18.9150, lng: 72.8260 },

  // ── Navi Mumbai Corridor ──
  { id: 'MUM-VASHI',   name: 'Navi Mumbai Vashi Terminal',               lat: 19.0770, lng: 72.9986 },
  { id: 'MUM-BELAPUR', name: 'CBD Belapur & Kharghar Tech Node',          lat: 19.0269, lng: 73.0400 },

  // ── Custom Coordinates ──
  { id: 'CUSTOM',      name: '📍 Custom Drop (Enter Customer GPS Lat-Lng)', lat: null,    lng: null },
];

export default function MissionDispatchPage({
  drones = [],
  hub = MUMBAI_HUB,
  onRouteResult,
  onNavigateToDashboard,
  onNavigateToMissions,
  onRefreshFleet,
}) {
  // Dispatcher & Order state
  const [dispatcherName,   setDispatcherName]   = useState('Agent Rohit Verma');
  const [orderId,          setOrderId]          = useState('ORD-MUM-8421');
  const [cargoPriority,    setCargoPriority]    = useState('EXPRESS');

  // Drone & Target state
  const [selectedDroneId,  setSelectedDroneId]  = useState('');
  const [destinationId,    setDestinationId]    = useState('MUM-VIRAR');
  const [customLat,        setCustomLat]        = useState('');
  const [customLng,        setCustomLng]        = useState('');
  const [payloadWeight,    setPayloadWeight]    = useState(1.8);
  const [dispatchLoading,  setDispatchLoading]  = useState(false);
  const [lastDispatched,   setLastDispatched]   = useState(null);

  // New Drone Form Modal State
  const [showAddDrone,        setShowAddDrone]        = useState(false);
  const [newDroneId,          setNewDroneId]          = useState('');
  const [newDroneModel,       setNewDroneModel]       = useState('OctoCopter HeavyLifter');
  const [newDronePayload,     setNewDronePayload]     = useState(4.5);
  const [newDroneBattery,     setNewDroneBattery]     = useState(100);
  const [newDroneSecretCode,  setNewDroneSecretCode]  = useState('');
  const [addLoading,          setAddLoading]          = useState(false);

  // Individual Decommission Authorization Modal State
  const [droneToDelete,       setDroneToDelete]       = useState(null);
  const [deleteSecretCode,    setDeleteSecretCode]    = useState('');
  const [deleteLoading,       setDeleteLoading]       = useState(false);

  // LLM Pre-Flight Safety Advisor State
  const [llmResult,        setLlmResult]        = useState(null);
  const [llmLoading,       setLlmLoading]       = useState(false);

  // Auto-select first drone if not selected
  useEffect(() => {
    if (drones.length > 0) {
      if (!selectedDroneId || !drones.find(d => d.id === selectedDroneId)) {
        setSelectedDroneId(drones[0].id);
      }
    } else if (selectedDroneId) {
      setSelectedDroneId('');
    }
  }, [drones, selectedDroneId]);

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

  // Haversine distance calculator (MMR Midpoint Hub to Target)
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
  const currentHub = hub || MUMBAI_HUB;
  const flightDistanceKm = resolvedDest && resolvedDest.lat && resolvedDest.lng
    ? calcDistanceKm(currentHub.lat, currentHub.lng, resolvedDest.lat, resolvedDest.lng)
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
        wind_gust_ms: 6.0,
      });
      setLlmResult(res);
    } catch (err) {
      console.warn('LLM safety check error:', err);
    } finally {
      setLlmLoading(false);
    }
  };

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
    isOverweight ? `Package mass (${payloadWeight.toFixed(1)} kg) exceeds ${selectedDrone?.id} limit (${maxPayload.toFixed(1)} kg). Choose a heavier drone or reduce mass.` :
    isBatteryCritical ? `Current battery (${currentBattery.toFixed(0)}%) too low for ${flightDistanceKm.toFixed(1)} km delivery. Predicted drain ${predictedDrainPct}% leaves only ${remainingBatteryOnArrival}%. Need >= ${(predictedDrainPct + 20)}% charge.` :
    isBatteryTight ? `Mission feasible but leaves tight ${remainingBatteryOnArrival}% reserve upon delivery. Drone should RTB immediately post-drop.` :
    `AI validated: Safe payload ratio (${((payloadWeight/maxPayload)*100).toFixed(0)}%) & healthy ${remainingBatteryOnArrival}% battery reserve upon arrival.`
  );

  // Register Drone with Mandatory Secret Code (Stored in MongoDB)
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
        secret_code: newDroneSecretCode.trim(),
      });
      toast(`Drone ${newDroneId.toUpperCase()} registered & secured with Secret Code!`, 'success');
      setSelectedDroneId(newDroneId.trim().toUpperCase());
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

  // Confirm and Execute Single Drone Decommission with Secret Code Verification
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
      toast(`Drone ${droneToDelete} authorized and decommissioned from fleet!`, 'success');
      setDroneToDelete(null);
      setDeleteSecretCode('');
      onRefreshFleet?.();
    } catch (err) {
      toast(`Decommission failed: ${err.message}`, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Dispatch Mission
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
      // Calculate GA optimal path from Midpoint Hub
      const route = await optimizeRoute({
        origin:               { lat: currentHub.lat, lng: currentHub.lng },
        destination:          { lat: dest.lat,       lng: dest.lng       },
        payload_weight_kg:    payloadWeight,
        wind_speed_ms:        5.0,
        max_battery_drain_pct: 90.0,
        intermediate_stops:   [],
      });
      onRouteResult?.(route);

      // Dispatch mission
      await dispatchMission({
        drone_id: selectedDroneId,
        destination: { lat: dest.lat, lng: dest.lng },
        destination_name: dest.name,
        order_id: orderId,
        agent_name: dispatcherName,
        payload_weight_kg: payloadWeight,
      });

      setLastDispatched({
        orderId,
        droneId: selectedDroneId,
        destinationName: dest.name,
        time: new Date().toLocaleTimeString(),
      });

      toast(`🚀 Order ${orderId} Assigned to ${selectedDroneId}! Launching to ${dest.name}`, 'success');
      generateNewOrderId();

      // Stay on dispatch page — user can assign more drones
      // Next available (non-delivering) drone auto-selected
      setTimeout(() => {
        const nextDrone = drones.find(d => d.id !== selectedDroneId && d.status !== 'DELIVERING');
        if (nextDrone) {
          setSelectedDroneId(nextDrone.id);
        }
      }, 500);
    } catch (err) {
      toast(`Dispatch assignment failed: ${err.message}`, 'error');
    } finally {
      setDispatchLoading(false);
    }
  };

  return (
    <div style={{
      height: '100%',
      maxHeight: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#030a17',
      overflow: 'hidden',
      flex: 1,
    }}>
      {/* ── TOP HEADER: Left: Mission Dispatch | Right: Move to Dashboard & Delivery Logs ── */}
      <div style={{
        padding: '12px 28px',
        background: 'rgba(8, 16, 33, 0.95)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        {/* Left: Sirf Dispatch Mission */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🚀</span>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
            Mission Dispatch
          </h1>
        </div>

        {/* Right: Move to Dashboard (back button) aur Delivery Logs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onNavigateToDashboard}
            className="btn btn-ghost btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              borderColor: 'rgba(0, 212, 255, 0.35)',
              color: 'var(--brand-primary)',
              fontWeight: 700,
              fontSize: 11.5,
              cursor: 'pointer',
            }}
            id="btn-move-to-dashboard"
          >
            <ArrowLeft size={14} /> Move to Dashboard
          </button>

          <button
            onClick={onNavigateToMissions}
            className="btn btn-ghost btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 11.5,
              cursor: 'pointer',
            }}
            id="btn-delivery-logs"
          >
            <Package size={14} /> Delivery Logs
          </button>
        </div>
      </div>

      {/* ── MAIN WORKSPACE (NO MAP, CLEAN SPACIOUS COMMAND CENTER) ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 1200,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>

          {/* ── ACTIVE DISPATCH SUCCESS BANNER ── */}
          {lastDispatched && (
            <div style={{
              padding: '16px 20px',
              background: 'linear-gradient(90deg, rgba(6, 255, 165, 0.12) 0%, rgba(0, 212, 255, 0.08) 100%)',
              border: '1px solid rgba(6, 255, 165, 0.45)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 26 }}>🚀</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#06ffa5', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Order {lastDispatched.orderId} Assigned to {lastDispatched.droneId}!</span>
                    <span style={{ fontSize: 10, background: 'rgba(6,255,165,0.2)', padding: '2px 8px', borderRadius: 10, color: '#06ffa5', fontWeight: 800 }}>
                      FLYING LIVE
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Destination: <strong style={{ color: '#fff' }}>{lastDispatched.destinationName}</strong> • Dispatched by {dispatcherName} at {lastDispatched.time}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={onNavigateToDashboard}
                  className="btn btn-primary btn-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 0 14px rgba(0,212,255,0.4)',
                  }}
                  id="btn-view-live-drone-map"
                >
                  <Radio size={14} /> View All Drones Moving on Map ➔
                </button>
              </div>
            </div>
          )}

          {/* 2-Column Balanced Form Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
            gap: 20,
          }}>

            {/* ── COLUMN 1: Order & Destination ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Section 1: Delivery Assignment */}
              <div className="panel-section" style={{ margin: 0, padding: 18, background: 'rgba(5, 12, 24, 0.95)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800 }}>
                    <FileText size={14} color="var(--brand-primary)" /> Delivery Order & Dispatcher
                  </span>
                  <span style={{ fontSize: 9.5, color: 'var(--brand-primary)', background: 'rgba(0,212,255,0.1)', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>
                    MMR MIDPOINT BASE (KANDIVALI)
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 11 }}>Delivery Agent</label>
                    <input
                      type="text"
                      className="form-input"
                      value={dispatcherName}
                      onChange={e => setDispatcherName(e.target.value)}
                      placeholder="Agent Name"
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span>Order ID</span>
                      <RotateCw size={11} style={{ cursor: 'pointer', color: 'var(--brand-primary)' }} onClick={generateNewOrderId} title="Generate new code" />
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
                  <label className="form-label" style={{ fontSize: 11, marginBottom: 6 }}>Priority Tier</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { id: 'STANDARD', label: 'Standard', color: 'var(--text-secondary)' },
                      { id: 'EXPRESS',  label: '⚡ Express', color: 'var(--brand-primary)' },
                      { id: 'MEDICAL',  label: '🚑 Medical', color: 'var(--brand-danger)' },
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setCargoPriority(p.id)}
                        className={`btn btn-sm ${cargoPriority === p.id ? 'btn-primary' : 'btn-ghost'}`}
                        style={{
                          fontSize: 11,
                          padding: '7px 10px',
                          borderColor: cargoPriority === p.id ? 'var(--brand-primary)' : 'var(--border-subtle)',
                          fontWeight: cargoPriority === p.id ? 800 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 2: Destination & Cargo Weight */}
              <div className="panel-section" style={{ margin: 0, padding: 18, background: 'rgba(5, 12, 24, 0.95)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div className="panel-title" style={{ fontSize: 13, fontWeight: 800, marginBottom: 14 }}>
                  <MapPin size={14} color="var(--brand-primary)" /> Assign Destination & Cargo Mass
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Delivery Destination Hub (Virar to South Bombay)</label>
                  <select
                    className="form-select"
                    value={destinationId}
                    onChange={e => setDestinationId(e.target.value)}
                    style={{ fontSize: 12, padding: '8px 10px' }}
                  >
                    {MUMBAI_DESTINATIONS.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {destinationId === 'CUSTOM' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 10.5 }}>Latitude (°N)</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="form-input"
                        placeholder="19.1940"
                        value={customLat}
                        onChange={e => setCustomLat(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 10.5 }}>Longitude (°E)</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="form-input"
                        placeholder="72.8550"
                        value={customLng}
                        onChange={e => setCustomLng(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className="form-label" style={{ margin: 0, fontSize: 11 }}>Package Payload Mass</label>
                    <span className="text-mono" style={{ fontSize: 13, fontWeight: 800, color: isOverweight ? 'var(--brand-danger)' : 'var(--brand-primary)' }}>
                      {payloadWeight.toFixed(1)} kg {isOverweight ? '⚠️ (Exceeds Limit)' : ''}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="8.0"
                    step="0.1"
                    value={payloadWeight}
                    onChange={e => setPayloadWeight(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    <span>0.5 kg (Light)</span>
                    <span>4.0 kg (Standard)</span>
                    <span>8.0 kg (Heavy)</span>
                  </div>
                </div>
              </div>

            </div>

            {/* ── COLUMN 2: Airframe & AI Pre-flight Check ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Section 3: Drone Airframe Selection (Single Drone Delete with Secret Code) */}
              <div className="panel-section" style={{ margin: 0, padding: 18, background: 'rgba(5, 12, 24, 0.95)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800 }}>
                    <Navigation size={14} color="var(--brand-primary)" /> Select Fleet Airframe ({drones.length} active)
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 10px', fontSize: 10.5, borderColor: 'rgba(0,212,255,0.4)', color: 'var(--brand-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => setShowAddDrone(true)}
                    >
                      <PlusCircle size={11} /> + Add Drone
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <select
                    className="form-select"
                    value={selectedDroneId}
                    onChange={e => setSelectedDroneId(e.target.value)}
                    style={{ flex: 1, fontSize: 12, padding: '8px 10px' }}
                  >
                    {drones.map(d => {
                      const isDelivering = d.status === 'DELIVERING';
                      const isReturning = d.status === 'RETURNING';
                      const statusTag = isDelivering ? `⚡ EN ROUTE (${d.order_id || 'MISSION'})` : isReturning ? '🔄 RETURNING' : '🟢 READY / STANDBY';
                      return (
                        <option key={d.id} value={d.id}>
                          {d.id} — {d.model} • {d.battery_pct?.toFixed(0)}% Bat [{statusTag}]
                        </option>
                      );
                    })}
                  </select>
                  {selectedDroneId && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      title={`Decommission ${selectedDroneId} (Requires Secret Code)`}
                      onClick={() => {
                        setDroneToDelete(selectedDroneId);
                        setDeleteSecretCode('');
                      }}
                      style={{ padding: '0 12px', color: 'var(--brand-danger)', borderColor: 'rgba(255,61,87,0.35)', cursor: 'pointer' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {selectedDrone && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(8,15,31,0.6)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: 11,
                    textAlign: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>UNIT ID</div>
                      <strong style={{ color: 'var(--text-primary)', fontSize: 12 }}>{selectedDrone.id}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>MAX PAYLOAD</div>
                      <strong style={{ color: 'var(--brand-primary)', fontSize: 12 }}>{selectedDrone.max_payload_kg} kg</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>BATTERY</div>
                      <strong style={{ color: selectedDrone.battery_pct > 50 ? 'var(--brand-accent)' : 'var(--brand-warning)', fontSize: 12 }}>
                        {selectedDrone.battery_pct?.toFixed(0)}%
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: AI Pre-Flight Safety Advisor (Gemini 3.8 Flash) */}
              <div className="panel-section" style={{
                background: aiVerdictBg,
                border: `1px solid ${aiVerdictBorder}`,
                borderRadius: 10,
                padding: 18,
                margin: 0,
                boxShadow: `0 0 16px ${aiVerdictBorder}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={15} color={aiVerdictColor} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: aiVerdictColor, textTransform: 'uppercase' }}>
                      AI Pre-Flight Safety Interlock
                    </span>
                    <span style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: 'rgba(0, 212, 255, 0.12)',
                      color: 'var(--brand-primary)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <Bot size={11} />
                      {llmLoading ? 'Analyzing...' : '✨ Gemini 3.8 Flash'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={fetchLlmSafetyCheck}
                      title="Re-run LLM Flight Safety Evaluation"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '3px 8px', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <RefreshCw size={11} className={llmLoading ? 'spin-anim' : ''} />
                    </button>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: aiVerdictBg,
                      color: aiVerdictColor,
                      border: `1px solid ${aiVerdictBorder}`,
                    }}>
                      {aiVerdict}
                    </span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 6px', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>DISTANCE</div>
                    <div className="text-mono" style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand-primary)' }}>
                      {flightDistanceKm.toFixed(1)} km
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 6px', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>PRED. DRAIN</div>
                    <div className="text-mono" style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand-secondary)' }}>
                      ~{predictedDrainPct}%
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 6px', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>ON ARRIVAL</div>
                    <div className="text-mono" style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: remainingBatteryOnArrival < 20 ? 'var(--brand-danger)' : remainingBatteryOnArrival < 35 ? 'var(--brand-warning)' : 'var(--brand-accent)'
                    }}>
                      {remainingBatteryOnArrival}%
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 6px', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>PAYLOAD</div>
                    <div className="text-mono" style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: isOverweight ? 'var(--brand-danger)' : 'var(--brand-accent)'
                    }}>
                      {payloadWeight.toFixed(1)}/{maxPayload.toFixed(0)}k
                    </div>
                  </div>
                </div>

                {/* Verdict Box */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 11,
                  lineHeight: '1.45',
                  color: aiVerdictColor,
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: 'rgba(0,0,0,0.35)',
                }}>
                  {isOverweight ? (
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  ) : isBatteryCritical ? (
                    <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  ) : isBatteryTight ? (
                    <Zap size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  ) : (
                    <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <strong>{aiVerdictLabel}</strong>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 10.5, marginTop: 3 }}>
                      {aiVerdictMessage}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── FLEET HOT-STANDBY UNITS ROW ── */}
          <div style={{
            padding: '14px 18px',
            background: 'rgba(8, 16, 33, 0.75)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', flexShrink: 0 }}>
              Fleet Hot-Standby Units ({drones.length}):
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
              {drones.map(d => {
                const isSelected = d.id === selectedDroneId;
                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDroneId(d.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      background: isSelected ? 'rgba(0, 212, 255, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: isSelected ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                      {d.id}
                    </div>
                    <div style={{ fontSize: 11, color: d.battery_pct > 50 ? 'var(--brand-accent)' : 'var(--brand-warning)', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                      {d.battery_pct?.toFixed(0)}%
                    </div>
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                      {d.status}
                    </span>
                  </div>
                );
              })}
            </div>

            {lastDispatched && (
              <div style={{ fontSize: 11, color: 'var(--brand-accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={14} /> Dispatched {lastDispatched.orderId} to {lastDispatched.destinationName} ({lastDispatched.time})
              </div>
            )}
          </div>

          {/* ── BIG GLOWING LAUNCH MISSION BUTTON ── */}
          <button
            type="button"
            className="btn btn-primary"
            style={{
              padding: '18px 24px',
              fontSize: 14.5,
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              background: isBlocked
                ? 'rgba(255,61,87,0.2)'
                : 'linear-gradient(135deg, #00d4ff 0%, #06ffa5 100%)',
              color: isBlocked ? '#ff3d57' : '#020811',
              border: isBlocked ? '1px solid rgba(255,61,87,0.5)' : 'none',
              borderRadius: 10,
              cursor: isBlocked || dispatchLoading ? 'not-allowed' : 'pointer',
              opacity: isBlocked ? 0.75 : 1,
              boxShadow: isBlocked ? 'none' : '0 6px 30px rgba(0, 212, 255, 0.45)',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
            }}
            onClick={handleAssignAndDispatch}
            disabled={dispatchLoading || isBlocked}
            id="launch-mission-btn"
          >
            <Send size={18} />
            {dispatchLoading ? 'Computing Genetic Algorithm Route & Launching Mission...' : isBlocked ? 'Dispatch Interlock Active — Resolve Warnings' : '🚀 Launch Autonomous Delivery Mission'}
          </button>

        </div>
      </div>

      {/* ── DYNAMIC ADD DRONE MODAL (WITH MANDATORY SECRET CODE STORED IN DB) ── */}
      {showAddDrone && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <form
            onSubmit={handleRegisterDrone}
            style={{
              width: 390,
              padding: 22,
              background: 'rgba(8, 16, 33, 0.98)',
              border: '1px solid rgba(0, 212, 255, 0.35)',
              borderRadius: 12,
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--brand-primary)', textTransform: 'uppercase' }}>
                Enlist New Drone to Mumbai Fleet
              </span>
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
                placeholder="e.g. BOM-004"
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
                placeholder="e.g. Phantom-Mumbai X7"
                value={newDroneModel}
                onChange={e => setNewDroneModel(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label className="form-label">Payload (kg)</label>
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
                <label className="form-label">Battery (%)</label>
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
          zIndex: 1100,
        }}>
          <form
            onSubmit={handleConfirmDecommission}
            style={{
              width: 390,
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
