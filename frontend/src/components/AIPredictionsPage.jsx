// AeroRoute — Dedicated AI & Soft Computing Predictions Page
import { useState } from 'react';
import {
  Zap,
  Cpu,
  Shield,
  Navigation,
  Wind,
  Package,
  Mountain,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Layers
} from 'lucide-react';
import { predictBattery, optimizeRoute, evaluateSafety } from '../services/api';
import { toast } from './Toast';

const MUMBAI_HUB = { lat: 19.0657, lng: 72.8687, name: 'Mumbai BKC Logistics Base' };
const MUMBAI_TARGETS = [
  { id: 'T1', name: 'Nariman Point Financial Hub', lat: 18.9256, lng: 72.8242 },
  { id: 'T2', name: 'Andheri East IT Park',        lat: 19.1136, lng: 72.8697 },
  { id: 'T3', name: 'Powai Hiranandani',           lat: 19.1176, lng: 72.9060 },
  { id: 'T4', name: 'Navi Mumbai Vashi Hub',       lat: 19.0770, lng: 72.9986 },
  { id: 'T5', name: 'Borivali Cargo Center',       lat: 19.2307, lng: 72.8567 },
];

export default function AIPredictionsPage() {
  // 1. ML Battery Predictor state
  const [payloadKg,       setPayloadKg]       = useState(2.0);
  const [distanceKm,      setDistanceKm]      = useState(12.0);
  const [elevationDelta,  setElevationDelta]  = useState(75.0);
  const [windMs,          setWindMs]          = useState(6.0);
  const [batteryResult,   setBatteryResult]   = useState(null);
  const [batLoading,      setBatLoading]      = useState(false);

  // 2. GA Path Planning state
  const [gaTargetId,      setGaTargetId]      = useState('T1');
  const [gaPayload,       setGaPayload]       = useState(2.0);
  const [gaWind,          setGaWind]          = useState(5.0);
  const [gaMaxBat,        setGaMaxBat]        = useState(80);
  const [gaResult,        setGaResult]        = useState(null);
  const [gaLoading,       setGaLoading]       = useState(false);

  // 3. Fuzzy Safety System state
  const [fsiWind,         setFsiWind]         = useState(12.0);
  const [fsiBat,          setFsiBat]          = useState(45.0);
  const [fsiDist,         setFsiDist]         = useState(8.5);
  const [fsiResult,       setFsiResult]       = useState(null);
  const [fsiLoading,      setFsiLoading]      = useState(false);

  // Run ML Prediction
  const handlePredictBattery = async () => {
    setBatLoading(true);
    try {
      const res = await predictBattery({
        payload_weight_kg:  payloadKg,
        elevation_change_m: elevationDelta,
        distance_km:        distanceKm,
        wind_speed_ms:      windMs,
      });
      setBatteryResult(res);
      toast(`Predicted Battery Drain: ${res.predicted_drain_percent}% (${res.risk_level} risk)`, 'success');
    } catch (e) {
      toast(`Prediction failed: ${e.message}`, 'error');
    } finally {
      setBatLoading(false);
    }
  };

  // Run GA Optimizer
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
      toast(`GA Optimal Route: ${res.total_distance_km} km across ${res.waypoints.length} waypoints`, 'success');
    } catch (e) {
      toast(`GA failed: ${e.message}`, 'error');
    } finally {
      setGaLoading(false);
    }
  };

  // Run Fuzzy Safety Evaluation
  const handleEvaluateFSI = async () => {
    setFsiLoading(true);
    try {
      const res = await evaluateSafety({
        wind_gust_ms:       fsiWind,
        battery_level_pct:  fsiBat,
        distance_to_hub_km: fsiDist,
      });
      setFsiResult(res);
      toast(`Flight Safety Index: ${res.safety_index} (${res.action_status})`, 'success');
    } catch (e) {
      toast(`FSI evaluation failed: ${e.message}`, 'error');
    } finally {
      setFsiLoading(false);
    }
  };

  return (
    <div style={{
      height: 'calc(100vh - 60px)',
      maxHeight: 'calc(100vh - 60px)',
      overflowY: 'auto',
      padding: '24px 32px',
      boxSizing: 'border-box',
    }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#001020', fontWeight: 800
          }}>
            <Cpu size={18} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            AI & Soft Computing Prediction Engine
          </h1>
          <span className="status-chip DELIVERING" style={{ fontSize: 10, marginLeft: 6 }}>
            Interactive Simulations
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Run standalone Machine Learning battery estimations, Genetic Algorithm path simulations, and Mamdani Fuzzy Safety Index evaluations.
        </p>
      </div>

      {/* 3-Column Spacious Grid Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 20,
        marginBottom: 24,
      }}>

        {/* ── CARD 1: ML Battery Consumption Estimator ── */}
        <div className="glass-card" style={{ padding: 20, borderTop: '2px solid var(--brand-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Zap size={18} color="var(--brand-primary)" />
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              ML Battery Regressor
            </h2>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><Package size={10} style={{ marginRight: 4 }} />Payload Mass</span>
              <span className="text-mono text-accent">{payloadKg.toFixed(1)} kg</span>
            </label>
            <input
              type="range" className="form-range" min={0.2} max={6.0} step={0.1}
              value={payloadKg} onChange={e => setPayloadKg(parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><MapPin size={10} style={{ marginRight: 4 }} />Distance</span>
              <span className="text-mono text-accent">{distanceKm.toFixed(1)} km</span>
            </label>
            <input
              type="range" className="form-range" min={1.0} max={30.0} step={0.5}
              value={distanceKm} onChange={e => setDistanceKm(parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><Mountain size={10} style={{ marginRight: 4 }} />Elevation Delta</span>
              <span className="text-mono text-accent">{elevationDelta.toFixed(0)} m</span>
            </label>
            <input
              type="range" className="form-range" min={-50} max={250} step={5}
              value={elevationDelta} onChange={e => setElevationDelta(parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><Wind size={10} style={{ marginRight: 4 }} />Wind Speed</span>
              <span className="text-mono text-accent">{windMs.toFixed(1)} m/s</span>
            </label>
            <input
              type="range" className="form-range" min={0} max={25} step={0.5}
              value={windMs} onChange={e => setWindMs(parseFloat(e.target.value))}
            />
          </div>

          <button
            className={`btn btn-primary btn-full ${batLoading ? 'btn-loading' : ''}`}
            onClick={handlePredictBattery}
            disabled={batLoading}
            style={{ marginTop: 8, padding: '10px' }}
          >
            {!batLoading && <Zap size={14} />}
            {batLoading ? 'Estimating…' : 'Predict Battery Consumption'}
          </button>

          {/* Result Card */}
          {batteryResult && (
            <div className="route-result" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Predicted Drain:</span>
                <span style={{ fontSize: 24, fontWeight: 900, fontFamily: 'JetBrains Mono', color:
                  batteryResult.risk_level === 'CRITICAL' ? 'var(--brand-danger)' :
                  batteryResult.risk_level === 'HIGH' ? 'var(--brand-warning)' : 'var(--brand-accent)'
                }}>
                  {batteryResult.predicted_drain_percent}%
                </span>
              </div>
              <div className="route-stat-row">
                <span className="route-stat-label">Reserve Remaining</span>
                <span className="route-stat-value">{batteryResult.estimated_remaining_percent}%</span>
              </div>
              <div className="route-stat-row">
                <span className="route-stat-label">95% Confidence Band</span>
                <span className="route-stat-value">{batteryResult.confidence_interval[0]}% – {batteryResult.confidence_interval[1]}%</span>
              </div>
              <div className="route-stat-row" style={{ borderBottom: 'none' }}>
                <span className="route-stat-label">Mission Risk Status</span>
                <span className={`status-chip ${batteryResult.risk_level === 'LOW' ? 'DELIVERING' : 'RTB'}`}>{batteryResult.risk_level}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── CARD 2: Genetic Algorithm Route Simulator ── */}
        <div className="glass-card" style={{ padding: 20, borderTop: '2px solid var(--brand-accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Navigation size={18} color="var(--brand-accent)" />
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              GA Route Planner & NFZ Evasion
            </h2>
          </div>

          <div className="form-group">
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

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Payload Weight</span>
              <span className="text-mono" style={{ color: 'var(--brand-accent)' }}>{gaPayload.toFixed(1)} kg</span>
            </label>
            <input
              type="range" className="form-range" min={0.5} max={5.0} step={0.1}
              value={gaPayload} onChange={e => setGaPayload(parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Wind Velocity</span>
              <span className="text-mono" style={{ color: 'var(--brand-accent)' }}>{gaWind.toFixed(1)} m/s</span>
            </label>
            <input
              type="range" className="form-range" min={0} max={25} step={0.5}
              value={gaWind} onChange={e => setGaWind(parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Max Battery Threshold</span>
              <span className="text-mono" style={{ color: 'var(--brand-accent)' }}>{gaMaxBat}%</span>
            </label>
            <input
              type="range" className="form-range" min={20} max={90} step={5}
              value={gaMaxBat} onChange={e => setGaMaxBat(parseInt(e.target.value))}
            />
          </div>

          <button
            className={`btn btn-accent btn-full ${gaLoading ? 'btn-loading' : ''}`}
            onClick={handleOptimizeGA}
            disabled={gaLoading}
            style={{ marginTop: 8, padding: '10px' }}
          >
            {!gaLoading && <Navigation size={14} />}
            {gaLoading ? 'Solving GA Generations…' : 'Solve Optimal GA Route'}
          </button>

          {/* GA Result Card */}
          {gaResult && (
            <div className="route-result" style={{ marginTop: 14 }}>
              <div className="route-stat-row">
                <span className="route-stat-label">Convergence Status</span>
                <span className="status-chip DELIVERING">✓ {gaResult.optimisation_status}</span>
              </div>
              <div className="route-stat-row">
                <span className="route-stat-label">Optimal Distance</span>
                <span className="route-stat-value">{gaResult.total_distance_km} km</span>
              </div>
              <div className="route-stat-row">
                <span className="route-stat-label">Estimated Flight Time</span>
                <span className="route-stat-value">{gaResult.estimated_eta_minutes} mins</span>
              </div>
              <div className="route-stat-row">
                <span className="route-stat-label">Waypoints</span>
                <span className="route-stat-value">{gaResult.waypoints.length} nodes</span>
              </div>
              {/* Fitness Sparkline */}
              {gaResult.fitness_history?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>GA Convergence Curve:</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 26 }}>
                    {gaResult.fitness_history.map((v, i) => {
                      const max = Math.max(...gaResult.fitness_history);
                      const min = Math.min(...gaResult.fitness_history);
                      const pct = max === min ? 100 : ((v - min) / (max - min)) * 100;
                      return (
                        <div key={i} style={{
                          flex: 1, height: `${Math.max(4, 100 - pct)}%`,
                          background: 'var(--brand-accent)', borderRadius: '2px 2px 0 0', opacity: 0.8
                        }} />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CARD 3: Mamdani Fuzzy Flight Safety Index (FSI) ── */}
        <div className="glass-card" style={{ padding: 20, borderTop: '2px solid #a78bfa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Shield size={18} color="#a78bfa" />
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              Mamdani Fuzzy Safety
            </h2>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><Wind size={10} style={{ marginRight: 4 }} />Wind Gust</span>
              <span className="text-mono" style={{ color: '#a78bfa' }}>{fsiWind.toFixed(1)} m/s</span>
            </label>
            <input
              type="range" className="form-range" min={0} max={30} step={0.5}
              value={fsiWind} onChange={e => setFsiWind(parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><Zap size={10} style={{ marginRight: 4 }} />Battery Reserve</span>
              <span className="text-mono" style={{ color: '#a78bfa' }}>{fsiBat.toFixed(0)}%</span>
            </label>
            <input
              type="range" className="form-range" min={0} max={100} step={1}
              value={fsiBat} onChange={e => setFsiBat(parseFloat(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><MapPin size={10} style={{ marginRight: 4 }} />Distance to Base</span>
              <span className="text-mono" style={{ color: '#a78bfa' }}>{fsiDist.toFixed(1)} km</span>
            </label>
            <input
              type="range" className="form-range" min={0.5} max={20.0} step={0.5}
              value={fsiDist} onChange={e => setFsiDist(parseFloat(e.target.value))}
            />
          </div>

          <button
            className={`btn btn-primary btn-full ${fsiLoading ? 'btn-loading' : ''}`}
            onClick={handleEvaluateFSI}
            disabled={fsiLoading}
            style={{
              marginTop: 18,
              padding: '10px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
              color: '#fff'
            }}
          >
            {!fsiLoading && <Shield size={14} />}
            {fsiLoading ? 'Evaluating Rules…' : 'Evaluate Fuzzy Safety Index'}
          </button>

          {/* FSI Result Card */}
          {fsiResult && (
            <div className="route-result" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Flight Safety Index:</span>
                <span style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono', color: fsiResult.status_color }}>
                  {fsiResult.safety_index} / 100
                </span>
              </div>
              <div className="route-stat-row">
                <span className="route-stat-label">Dispatch Recommendation</span>
                <span className={`status-chip ${fsiResult.action_status === 'SAFE' ? 'DELIVERING' : 'RTB'}`}>
                  {fsiResult.action_status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Fuzzy Membership Breakdown */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Fuzzy Class Activations:</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {fsiResult.rule_activations?.slice(0, 3).map((r, i) => (
                    <span key={i} style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--text-secondary)'
                    }}>
                      Rule {i+1}: {r.class} ({r.strength})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
