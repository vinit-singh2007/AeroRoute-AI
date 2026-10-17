// AeroRoute — Live Telemetry HUD
import { useMemo } from 'react';
import {
  Battery, Wind, Mountain, Activity,
  Shield, AlertTriangle, Radio,
  TrendingDown, Gauge
} from 'lucide-react';

// Semicircular Arc Gauge
function ArcGauge({ value, max = 100, color, label, unit, size = 100 }) {
  const radius = 40;
  const circumference = Math.PI * radius;  // half circle
  const pct = Math.min(Math.max(value / max, 0), 1);
  const offset = circumference * (1 - pct);

  const cx = size / 2;
  const cy = size / 2 + 8;

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease' }}
          filter={`drop-shadow(0 0 4px ${color}80)`}
        />
        {/* Value text */}
        <text
          x={cx} y={cy - 6}
          textAnchor="middle"
          fill={color}
          fontSize="15"
          fontWeight="800"
          fontFamily="JetBrains Mono, monospace"
        >
          {typeof value === 'number' ? value.toFixed(1) : value}
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" fill="rgba(120,160,200,0.6)" fontSize="9" fontFamily="Inter, sans-serif">
          {unit}
        </text>
      </svg>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: -4, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

// Battery Bar
function BatteryBar({ pct }) {
  const level = pct > 50 ? 'high' : pct > 25 ? 'medium' : 'low';
  const color = pct > 50 ? 'var(--brand-accent)' : pct > 25 ? 'var(--brand-warning)' : 'var(--brand-danger)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          <Battery size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />Battery
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace' }}>
          {Number(pct || 0).toFixed(1)}%
        </span>
      </div>
      <div className="battery-bar-wrap">
        <div className={`battery-bar-fill ${level}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// FSI Ring indicator
function FSIRing({ score }) {
  const safeScore = Number(score || 0);
  const color = safeScore >= 65 ? '#06ffa5' : safeScore >= 35 ? '#fbbf24' : '#ff3d57';
  const status = safeScore >= 65 ? 'SAFE' : safeScore >= 35 ? 'CAUTION' : 'DANGER';
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const pct = safeScore / 100;
  const offset = circumference * (1 - pct);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={110} height={110} viewBox="0 0 110 110">
          <circle cx="55" cy="55" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          <circle
            cx="55" cy="55" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 55 55)"
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease' }}
            filter={`drop-shadow(0 0 6px ${color}80)`}
          />
          <text x="55" y="50" textAnchor="middle" fill={color} fontSize="18" fontWeight="900" fontFamily="JetBrains Mono, monospace">
            {safeScore.toFixed(0)}
          </text>
          <text x="55" y="64" textAnchor="middle" fill="rgba(120,160,200,0.7)" fontSize="9" fontFamily="Inter, sans-serif">
            / 100
          </text>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
          Flight Safety Index
        </div>
        <div style={{
          fontSize: 14, fontWeight: 800, color,
          padding: '4px 12px',
          borderRadius: 20,
          background: `${color}15`,
          border: `1px solid ${color}40`,
          display: 'inline-block',
          letterSpacing: '1px',
        }}>
          {status}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          Fuzzy Inference Engine
        </div>
      </div>
    </div>
  );
}

export default function TelemetryHUD({ drones, selectedDroneId, onDroneSelect }) {
  const selected = useMemo(
    () => drones.find(d => d.id === selectedDroneId) || drones[0],
    [drones, selectedDroneId]
  );

  if (!selected) {
    return (
      <div className="panel-section" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
        <Radio size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
        <div style={{ fontSize: 13 }}>Awaiting telemetry stream…</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Connect to backend to see live data</div>
      </div>
    );
  }

  const windColor   = selected.wind_gust_ms > 15 ? '#ff3d57' : selected.wind_gust_ms > 8 ? '#fbbf24' : '#06ffa5';
  const altColor    = 'var(--brand-primary)';
  const speedColor  = selected.speed_kmh > 65 ? '#fbbf24' : 'var(--brand-primary)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

      {/* Drone Selector */}
      <div className="panel-section">
        <div className="panel-title"><Activity size={12} /> Live Telemetry</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {drones.map(d => (
            <button
              key={d.id}
              className={`btn btn-ghost btn-sm ${d.id === selectedDroneId ? 'active' : ''}`}
              onClick={() => onDroneSelect(d.id)}
              id={`drone-tab-${d.id}`}
              style={d.id === selectedDroneId ? {
                borderColor: 'var(--brand-primary)',
                color: 'var(--brand-primary)',
                background: 'rgba(0,212,255,0.08)',
              } : {}}
            >
              {d.id}
            </button>
          ))}
        </div>
      </div>

      {/* Drone ID & Status */}
      <div className="panel-section" style={{ paddingBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
              {selected.id}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selected.model}</div>
          </div>
          <span className={`status-chip ${selected.status}`}>{selected.status}</span>
        </div>

        {/* FSI Ring */}
        <FSIRing score={selected.fsi || 0} />

        {/* Assigned Order Information */}
        {selected.order_id && selected.order_id !== 'STANDBY' && (
          <div style={{
            background: 'rgba(0, 212, 255, 0.06)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            borderRadius: 8,
            padding: '8px 10px',
            marginTop: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--brand-primary)', fontWeight: 700, marginBottom: 2 }}>
              <span>📦 ORDER: {selected.order_id}</span>
              {selected.payload_kg > 0 && <span style={{ color: 'var(--text-secondary)' }}>{selected.payload_kg} kg</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
              ➔ {selected.destination_name}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
              Agent: {selected.agent_name}
            </div>
          </div>
        )}
      </div>

      {/* Battery */}
      <div className="panel-section">
        <BatteryBar pct={selected.battery_pct || 0} />
      </div>

      {/* Gauge Grid */}
      <div className="panel-section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          <ArcGauge
            value={selected.wind_gust_ms || 0}
            max={25}
            color={windColor}
            label="Wind"
            unit="m/s"
            size={90}
          />
          <ArcGauge
            value={selected.altitude_m || 0}
            max={200}
            color={altColor}
            label="Altitude"
            unit="m"
            size={90}
          />
          <ArcGauge
            value={selected.speed_kmh || 0}
            max={80}
            color={speedColor}
            label="Speed"
            unit="km/h"
            size={90}
          />
        </div>
      </div>

      {/* Coordinates & Heading */}
      <div className="panel-section">
        <div className="panel-title"><Gauge size={12} /> Live Position</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { label: 'Latitude',  value: selected.lat != null ? Number(selected.lat).toFixed(5) : '—', unit: '°N' },
            { label: 'Longitude', value: selected.lng != null ? Number(selected.lng).toFixed(5) : '—', unit: '°E' },
            { label: 'Heading',   value: selected.heading_deg != null ? Number(selected.heading_deg).toFixed(1) : '0.0', unit: '°' },
            { label: 'Wind Gust', value: selected.wind_gust_ms != null ? Number(selected.wind_gust_ms).toFixed(1) : '0.0', unit: 'm/s' },
          ].map(item => (
            <div key={item.label} className="metric-card">
              <div className="metric-label">{item.label}</div>
              <div className="metric-value" style={{ fontSize: 14 }}>
                {item.value}
                <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.6, marginLeft: 2 }}>{item.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Status Banner */}
      {selected.action_status && (
        <div className="panel-section">
          <div style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: selected.action_status === 'SAFE'
              ? 'rgba(6,255,165,0.08)'
              : selected.action_status === 'REROUTE_RECOMMENDED'
              ? 'rgba(251,191,36,0.1)'
              : 'rgba(255,61,87,0.1)',
            border: `1px solid ${
              selected.action_status === 'SAFE'       ? 'rgba(6,255,165,0.3)'  :
              selected.action_status === 'REROUTE_RECOMMENDED' ? 'rgba(251,191,36,0.3)' :
              'rgba(255,61,87,0.4)'
            }`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            {selected.action_status === 'SAFE'
              ? <Shield size={16} color="var(--brand-accent)" />
              : <AlertTriangle size={16} color={selected.action_status === 'REROUTE_RECOMMENDED' ? 'var(--brand-warning)' : 'var(--brand-danger)'} />
            }
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px', color:
                selected.action_status === 'SAFE' ? 'var(--brand-accent)' :
                selected.action_status === 'REROUTE_RECOMMENDED' ? 'var(--brand-warning)' :
                'var(--brand-danger)'
              }}>
                {selected.action_status.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                Fuzzy Logic Recommendation
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
