// AeroRoute — Sidebar AI & Predictions Component
import { useState } from 'react';
import {
  Zap,
  Navigation,
  Package,
  MapPin,
  Mountain,
  Wind,
  Cpu,
  CheckCircle2
} from 'lucide-react';
import { predictBattery, optimizeRoute } from '../services/api';
import { toast } from './Toast';

const MUMBAI_HUB = { lat: 19.0657, lng: 72.8687, name: 'Mumbai BKC Logistics Base' };
const MUMBAI_TARGETS = [
  { id: 'T1', name: 'Nariman Point Financial Hub', lat: 18.9256, lng: 72.8242 },
  { id: 'T2', name: 'Andheri East IT Park',        lat: 19.1136, lng: 72.8697 },
  { id: 'T3', name: 'Powai Hiranandani',           lat: 19.1176, lng: 72.9060 },
  { id: 'T4', name: 'Navi Mumbai Vashi Hub',       lat: 19.0770, lng: 72.9986 },
  { id: 'T5', name: 'Borivali Cargo Center',       lat: 19.2307, lng: 72.8567 },
];

export default function PredictionsPanel({ onRouteResult }) {
  const [activeSubTab, setActiveSubTab] = useState('battery'); // 'battery' | 'ga'

  // ML Battery state
  const [payloadKg,      setPayloadKg]      = useState(2.0);
  const [distanceKm,     setDistanceKm]     = useState(12.0);
  const [elevationDelta, setElevationDelta] = useState(75.0);
  const [windMs,         setWindMs]         = useState(6.0);
  const [batResult,      setBatResult]      = useState(null);
  const [batLoading,     setBatLoading]     = useState(false);

  // GA Optimizer state
  const [gaTargetId,     setGaTargetId]     = useState('T1');
  const [gaPayload,      setGaPayload]      = useState(2.0);
  const [gaWind,         setGaWind]         = useState(5.0);
  const [gaMaxBat,       setGaMaxBat]       = useState(80);
  const [gaResult,       setGaResult]       = useState(null);
  const [gaLoading,      setGaLoading]      = useState(false);

  const handlePredictBattery = async () => {
    setBatLoading(true);
    try {
      const res = await predictBattery({
        payload_weight_kg:  payloadKg,
        elevation_change_m: elevationDelta,
        distance_km:        distanceKm,
        wind_speed_ms:      windMs,
      });
      setBatResult(res);
      toast(`Predicted Drain: ${res.predicted_drain_percent}% (${res.risk_level})`, 'success');
    } catch (e) {
      toast(`Prediction failed: ${e.message}`, 'error');
    } finally {
      setBatLoading(false);
    }
  };

  const handleOptimizeGA = async () => {
    const target = MUMBAI_TARGETS.find(t => t.id === gaTargetId);
    setGaLoading(true);
    try {
      const res = await optimizeRoute({
        origin:               { lat: MUMBAI_HUB.lat, lng: MUMBAI_HUB.lng },
        destination:          { lat: target.lat,     lng: target.lng     },
        payload_weight_kg:    gaPayload,
        wind_speed_ms:        gaWind,
        max_battery_drain_pct: gaMaxBat,
        intermediate_stops:   [],
      });
      setGaResult(res);
      onRouteResult?.(res);
      toast(`Optimal Route: ${res.total_distance_km} km • Drawn on Map!`, 'success');
    } catch (e) {
      toast(`GA failed: ${e.message}`, 'error');
    } finally {
      setGaLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Subtab Toggle */}
      <div style={{
        display: 'flex',
        padding: '8px 12px',
        background: 'rgba(5,12,24,0.6)',
        borderBottom: '1px solid var(--border-subtle)',
        gap: 6
      }}>
        <button
          onClick={() => setActiveSubTab('battery')}
          style={{
            flex: 1,
            padding: '6px 8px',
            borderRadius: 6,
            border: activeSubTab === 'battery' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
            background: activeSubTab === 'battery' ? 'rgba(0,212,255,0.15)' : 'rgba(8,15,31,0.5)',
            color: activeSubTab === 'battery' ? 'var(--brand-primary)' : 'var(--text-muted)',
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            textTransform: 'uppercase'
          }}
        >
          <Zap size={11} /> ML Battery
        </button>

        <button
          onClick={() => setActiveSubTab('ga')}
          style={{
            flex: 1,
            padding: '6px 8px',
            borderRadius: 6,
            border: activeSubTab === 'ga' ? '1px solid var(--brand-accent)' : '1px solid var(--border-subtle)',
            background: activeSubTab === 'ga' ? 'rgba(6,255,165,0.15)' : 'rgba(8,15,31,0.5)',
            color: activeSubTab === 'ga' ? 'var(--brand-accent)' : 'var(--text-muted)',
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            textTransform: 'uppercase'
          }}
        >
          <Navigation size={11} /> GA Router
        </button>
      </div>

      {/* ── SUBSECTION 1: ML Battery Predictor ── */}
      {activeSubTab === 'battery' && (
        <div className="panel-section">
          <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={12} /> ML Battery Regressor
            </span>
            <span style={{ fontSize: 9, color: 'var(--brand-primary)', background: 'rgba(0,212,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>
              Gradient Boost
            </span>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><Package size={10} style={{ marginRight: 4 }} />Payload Mass</span>
              <span className="text-mono text-accent">{payloadKg.toFixed(1)} kg</span>
            </label>
            <input
              type="range" className="form-range" min={0.2} max={5.0} step={0.1}
              value={payloadKg} onChange={e => setPayloadKg(parseFloat(e.target.value))}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><MapPin size={10} style={{ marginRight: 4 }} />Flight Distance</span>
              <span className="text-mono text-accent">{distanceKm.toFixed(1)} km</span>
            </label>
            <input
              type="range" className="form-range" min={1.0} max={25.0} step={0.5}
              value={distanceKm} onChange={e => setDistanceKm(parseFloat(e.target.value))}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><Mountain size={10} style={{ marginRight: 4 }} />Elevation Delta</span>
              <span className="text-mono text-accent">{elevationDelta.toFixed(0)} m</span>
            </label>
            <input
              type="range" className="form-range" min={-50} max={200} step={5}
              value={elevationDelta} onChange={e => setElevationDelta(parseFloat(e.target.value))}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><Wind size={10} style={{ marginRight: 4 }} />Headwind Speed</span>
              <span className="text-mono text-accent">{windMs.toFixed(1)} m/s</span>
            </label>
            <input
              type="range" className="form-range" min={0} max={25} step={0.5}
              value={windMs} onChange={e => setWindMs(parseFloat(e.target.value))}
            />
          </div>

          <button
            className={`btn btn-primary btn-full btn-sm ${batLoading ? 'btn-loading' : ''}`}
            onClick={handlePredictBattery}
            disabled={batLoading}
            style={{ padding: '8px' }}
          >
            {!batLoading && <Zap size={13} />}
            {batLoading ? 'Predicting…' : 'Predict Battery Consumption'}
          </button>

          {batResult && (
            <div className="route-result" style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>PREDICTED CONSUMPTION:</span>
                <span style={{
                  fontSize: 22, fontWeight: 900, fontFamily: 'JetBrains Mono',
                  color: batResult.risk_level === 'CRITICAL' ? 'var(--brand-danger)' :
                         batResult.risk_level === 'HIGH' ? 'var(--brand-warning)' : 'var(--brand-accent)'
                }}>
                  {batResult.predicted_drain_percent}%
                </span>
              </div>
              <div className="route-stat-row">
                <span className="route-stat-label">Reserve Remaining</span>
                <span className="route-stat-value">{batResult.estimated_remaining_percent}%</span>
              </div>
              <div className="route-stat-row">
                <span className="route-stat-label">Confidence Band</span>
                <span className="route-stat-value">{batResult.confidence_interval[0]}% – {batResult.confidence_interval[1]}%</span>
              </div>
              <div className="route-stat-row" style={{ borderBottom: 'none' }}>
                <span className="route-stat-label">Mission Risk</span>
                <span className={`status-chip ${batResult.risk_level === 'LOW' ? 'DELIVERING' : 'RTB'}`}>{batResult.risk_level}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUBSECTION 2: GA Route Planner ── */}
      {activeSubTab === 'ga' && (
        <div className="panel-section">
          <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Navigation size={12} /> GA Path Optimizer
            </span>
            <span style={{ fontSize: 9, color: 'var(--brand-accent)', background: 'rgba(6,255,165,0.1)', padding: '2px 6px', borderRadius: 4 }}>
              Mumbai NFZ Guard
            </span>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label className="form-label">Destination Corridor</label>
            <select
              className="form-select"
              value={gaTargetId}
              onChange={e => setGaTargetId(e.target.value)}
            >
              {MUMBAI_TARGETS.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cargo Payload</span>
              <span className="text-mono" style={{ color: 'var(--brand-accent)' }}>{gaPayload.toFixed(1)} kg</span>
            </label>
            <input
              type="range" className="form-range" min={0.5} max={5.0} step={0.1}
              value={gaPayload} onChange={e => setGaPayload(parseFloat(e.target.value))}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Wind Velocity</span>
              <span className="text-mono" style={{ color: 'var(--brand-accent)' }}>{gaWind.toFixed(1)} m/s</span>
            </label>
            <input
              type="range" className="form-range" min={0} max={20} step={0.5}
              value={gaWind} onChange={e => setGaWind(parseFloat(e.target.value))}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Max Battery Budget</span>
              <span className="text-mono" style={{ color: 'var(--brand-accent)' }}>{gaMaxBat}%</span>
            </label>
            <input
              type="range" className="form-range" min={30} max={90} step={5}
              value={gaMaxBat} onChange={e => setGaMaxBat(parseInt(e.target.value))}
            />
          </div>

          <button
            className={`btn btn-accent btn-full btn-sm ${gaLoading ? 'btn-loading' : ''}`}
            onClick={handleOptimizeGA}
            disabled={gaLoading}
            style={{ padding: '8px' }}
          >
            {!gaLoading && <Navigation size={13} />}
            {gaLoading ? 'Solving Generations…' : 'Solve & Draw Optimal GA Route'}
          </button>

          {gaResult && (
            <div className="route-result" style={{ marginTop: 10 }}>
              <div className="route-stat-row">
                <span className="route-stat-label">Convergence</span>
                <span className="status-chip DELIVERING">✓ {gaResult.optimisation_status}</span>
              </div>
              <div className="route-stat-row">
                <span className="route-stat-label">Optimal Distance</span>
                <span className="route-stat-value">{gaResult.total_distance_km} km</span>
              </div>
              <div className="route-stat-row">
                <span className="route-stat-label">Flight Time</span>
                <span className="route-stat-value">{gaResult.estimated_eta_minutes} mins</span>
              </div>
              <div className="route-stat-row" style={{ borderBottom: 'none' }}>
                <span className="route-stat-label">Waypoints</span>
                <span className="route-stat-value">{gaResult.waypoints.length} nodes</span>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
