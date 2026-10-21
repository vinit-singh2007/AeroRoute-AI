import { useState } from 'react';
import { Zap, CloudLightning, Home, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { evaluateSafety } from '../services/api';
import { toast } from './Toast';

export default function EmergencyControls({ onSimulateStorm, onForceRTB, onReset, onClearFleet, selectedDrone }) {
  const [fsiLoading, setFsiLoading] = useState(false);
  const [fsiResult,  setFsiResult]  = useState(null);
  const [windInput,  setWindInput]  = useState(12);
  const [batInput,   setBatInput]   = useState(45);
  const [distInput,  setDistInput]  = useState(8);

  const handleFSI = async () => {
    setFsiLoading(true);
    try {
      const result = await evaluateSafety({
        wind_gust_ms:       windInput,
        battery_level_pct:  batInput,
        distance_to_hub_km: distInput,
      });
      setFsiResult(result);
      toast(`FSI: ${result.safety_index} — ${result.action_status}`,
            result.action_status === 'SAFE' ? 'success' :
            (result.action_status === 'CAUTION' || result.action_status === 'REROUTE_RECOMMENDED') ? 'warning' : 'error');
    } catch (e) {
      toast(`FSI evaluation failed: ${e.message}`, 'error');
    } finally {
      setFsiLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* FSI Manual Evaluation */}
      <div className="panel-section">
        <div className="panel-title"><ShieldAlert size={12} /> Fuzzy FSI Evaluator</div>
        <div style={{ marginBottom: 10 }}>
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Wind Gust</span>
            <span className="text-mono text-accent">{windInput} m/s</span>
          </label>
          <input type="range" className="form-range" min={0} max={30} step={0.5}
            value={windInput} onChange={e => setWindInput(parseFloat(e.target.value))} id="fsi-wind-range" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Battery Level</span>
            <span className="text-mono text-accent">{batInput}%</span>
          </label>
          <input type="range" className="form-range" min={0} max={100} step={1}
            value={batInput} onChange={e => setBatInput(parseFloat(e.target.value))} id="fsi-battery-range" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Distance to Hub</span>
            <span className="text-mono text-accent">{distInput} km</span>
          </label>
          <input type="range" className="form-range" min={0} max={20} step={0.5}
            value={distInput} onChange={e => setDistInput(parseFloat(e.target.value))} id="fsi-distance-range" />
        </div>
        <button
          className={`btn btn-primary btn-full btn-sm ${fsiLoading ? 'btn-loading' : ''}`}
          onClick={handleFSI}
          disabled={fsiLoading}
          id="evaluate-fsi-btn"
        >
          {!fsiLoading && <Zap size={12} />}
          {fsiLoading ? 'Evaluating…' : 'Evaluate FSI'}
        </button>

        {fsiResult && (
          <div className="route-result" style={{
            marginTop: 10,
            borderColor: fsiResult.action_status === 'SAFE' ? 'rgba(6,255,165,0.3)' :
                         (fsiResult.action_status === 'CAUTION' || fsiResult.action_status === 'REROUTE_RECOMMENDED') ? 'rgba(251,191,36,0.3)' : 'rgba(255,61,87,0.3)',
            background:  fsiResult.action_status === 'SAFE' ? 'rgba(6,255,165,0.04)' :
                         (fsiResult.action_status === 'CAUTION' || fsiResult.action_status === 'REROUTE_RECOMMENDED') ? 'rgba(251,191,36,0.04)' : 'rgba(255,61,87,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: fsiResult.status_color }}>
                {fsiResult.safety_index}
              </span>
              <span className={`status-chip ${
                fsiResult.action_status === 'SAFE' ? 'DELIVERING' :
                (fsiResult.action_status === 'CAUTION' || fsiResult.action_status === 'REROUTE_RECOMMENDED') ? 'RETURNING' : 'RTB'
              }`} style={{ fontSize: 10 }}>
                {fsiResult.action_status.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Fuzzy membership display */}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 6 }}>
              FUZZY MEMBERSHIPS
            </div>
            {Object.entries(fsiResult.fuzzy_memberships || {}).map(([dim, vals]) => (
              <div key={dim} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2, textTransform: 'capitalize' }}>{dim}:</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {Object.entries(vals).map(([label, strength]) => (
                    <div key={label} style={{
                      fontSize: 9,
                      padding: '2px 7px',
                      borderRadius: 10,
                      background: strength > 0.3 ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${strength > 0.3 ? 'rgba(0,212,255,0.4)' : 'var(--border-subtle)'}`,
                      color: strength > 0.3 ? 'var(--brand-primary)' : 'var(--text-muted)',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}>
                      {label}: {strength.toFixed(2)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Actions */}
      <div className="emergency-section">
        <div className="emergency-title"><CloudLightning size={12} /> Emergency Controls</div>
        <div className="emergency-grid">
          <button
            className="btn btn-warning btn-sm"
            onClick={() => { onSimulateStorm(); toast('Storm simulation activated — wind gusts elevated!', 'warning'); }}
            id="simulate-storm-btn"
          >
            <CloudLightning size={12} />
            Storm Sim
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => { onForceRTB(); toast('Force RTB issued — all drones returning to base!', 'error'); }}
            id="force-rtb-btn"
          >
            <Home size={12} />
            Force RTB
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { onReset(); toast('Fleet simulation reset to default', 'info'); }}
            id="reset-fleet-btn"
          >
            <RotateCcw size={12} />
            Reset Fleet
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { onClearFleet?.(); toast('All drones decommissioned from fleet', 'info'); }}
            style={{ color: 'var(--brand-danger)', borderColor: 'rgba(255,61,87,0.35)' }}
            id="clear-fleet-btn"
          >
            <Trash2 size={12} />
            Clear Fleet
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
          Storm Sim: raises wind gusts to 22–28 m/s across all drones, triggering FSI reroute/RTB recommendations.
        </div>
      </div>
    </div>
  );
}
