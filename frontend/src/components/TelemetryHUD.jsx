import { useMemo } from 'react';
import {
  Battery, Activity, Shield, AlertTriangle, Radio,
  Gauge, AlertOctagon, RefreshCw, CloudRain, Droplets
} from 'lucide-react';

// Semicircular Arc Gauge with dynamic alert styling
function ArcGauge({ value, max = 100, color, label, unit, size = 95, isAlert = false }) {
  const radius = 38;
  const circumference = Math.PI * radius; // half circle
  const numVal = typeof value === 'number' && !isNaN(value) ? value : 0;
  const pct = Math.min(Math.max(numVal / max, 0), 1);
  const offset = circumference * (1 - pct);

  const cx = size / 2;
  const cy = size / 2 + 8;
  const activeColor = isAlert ? '#ff3d57' : color;

  return (
    <div style={{
      textAlign: 'center',
      padding: '6px 4px',
      borderRadius: 8,
      background: isAlert ? 'rgba(255, 61, 87, 0.08)' : 'transparent',
      border: isAlert ? '1px solid rgba(255, 61, 87, 0.3)' : '1px solid transparent',
      transition: 'all 200ms ease',
    }}>
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={activeColor}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease' }}
          filter={`drop-shadow(0 0 6px ${activeColor}90)`}
        />
        {/* Value text */}
        <text
          x={cx} y={cy - 5}
          textAnchor="middle"
          fill={activeColor}
          fontSize="14"
          fontWeight="800"
          fontFamily="JetBrains Mono, monospace"
        >
          {typeof value === 'number' ? value.toFixed(1) : (value || '—')}
        </text>
        <text x={cx} y={cy + 7} textAnchor="middle" fill="rgba(120,160,200,0.6)" fontSize="9" fontFamily="Inter, sans-serif">
          {unit}
        </text>
      </svg>
      <div style={{
        fontSize: 9.5,
        color: isAlert ? '#ff3d57' : 'var(--text-muted)',
        marginTop: -3,
        fontWeight: 700,
        letterSpacing: '0.6px',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
    </div>
  );
}

// ── LIVE RAIN / PRECIPITATION GAUGE ──────────────────────────────────────
function RainGauge({ precipMm, condition, size = 95 }) {
  // Rain thresholds (mm/h): 0=dry, 0-2=light, 2-7.5=mod, 7.5-15=heavy, >15=violent
  const safeVal = typeof precipMm === 'number' && !isNaN(precipMm) ? precipMm : 0;
  const maxMm = 15;  // 15 mm/h = violent rain ceiling for gauge arc
  const pct = Math.min(safeVal / maxMm, 1);

  const color = safeVal === 0
    ? '#06ffa5'
    : safeVal < 2
      ? '#22d3ee'
      : safeVal < 7.5
        ? '#fbbf24'
        : safeVal < 15
          ? '#ff9f43'
          : '#ff3d57';

  const rainLabel = safeVal === 0
    ? 'DRY'
    : safeVal < 2
      ? 'LIGHT RAIN'
      : safeVal < 7.5
        ? 'MODERATE RAIN'
        : safeVal < 15
          ? 'HEAVY RAIN'
          : 'VIOLENT RAIN';

  const isAlert = safeVal >= 7.5;
  const radius = 38;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - pct);
  const cx = size / 2;
  const cy = size / 2 + 8;

  return (
    <div style={{
      textAlign: 'center',
      padding: '6px 4px',
      borderRadius: 8,
      background: isAlert ? `${color}14` : 'transparent',
      border: isAlert ? `1px solid ${color}40` : '1px solid transparent',
      transition: 'all 200ms ease',
    }}>
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease' }}
          filter={`drop-shadow(0 0 6px ${color}90)`}
        />
        {/* Precipitation value */}
        <text
          x={cx} y={cy - 5}
          textAnchor="middle"
          fill={color}
          fontSize="13"
          fontWeight="800"
          fontFamily="JetBrains Mono, monospace"
        >
          {safeVal.toFixed(1)}
        </text>
        <text x={cx} y={cy + 7} textAnchor="middle" fill="rgba(120,160,200,0.6)" fontSize="8" fontFamily="Inter, sans-serif">
          mm/h
        </text>
      </svg>
      {/* Rain label chip */}
      <div style={{
        fontSize: 8,
        color,
        marginTop: -3,
        fontWeight: 800,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        padding: '1px 5px',
        borderRadius: 4,
        background: `${color}18`,
        display: 'inline-block',
      }}>
        {rainLabel}
      </div>
    </div>
  );
}

// Battery Bar with real-time level alert
function BatteryBar({ pct }) {
  const numPct = typeof pct === 'number' && !isNaN(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  const isCritical = numPct < 25;
  const isLow = numPct < 45;
  const color = isCritical ? 'var(--brand-danger)' : isLow ? 'var(--brand-warning)' : 'var(--brand-accent)';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          <Battery size={11} style={{ marginRight: 4, verticalAlign: 'middle', color }} />
          Live Battery Reserve
        </span>
        <span style={{ fontSize: 13, fontWeight: 900, color, fontFamily: 'JetBrains Mono, monospace' }}>
          {pct != null ? `${numPct.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="battery-bar-wrap" style={{
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 4,
        height: 7,
        overflow: 'hidden',
        border: isCritical ? '1px solid rgba(255,61,87,0.5)' : 'none',
      }}>
        <div
          style={{
            width: `${numPct}%`,
            height: '100%',
            background: color,
            transition: 'width 0.4s ease, background 0.4s ease',
            boxShadow: `0 0 8px ${color}80`,
          }}
        />
      </div>
    </div>
  );
}

// FSI Ring indicator with real-time safety classification
function FSIRing({ score, isAlert = false }) {
  const safeScore = typeof score === 'number' && !isNaN(score) ? score : 0;
  const color = safeScore >= 65 ? '#06ffa5' : safeScore >= 35 ? '#fbbf24' : '#ff3d57';
  const status = safeScore >= 65 ? 'OPTIMAL' : safeScore >= 35 ? 'CAUTION' : 'DANGER';
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(safeScore / 100, 0), 1);
  const offset = circumference * (1 - pct);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '8px 10px',
      borderRadius: 10,
      background: isAlert ? 'rgba(255, 61, 87, 0.08)' : 'rgba(255, 255, 255, 0.02)',
      border: isAlert ? '1px solid rgba(255, 61, 87, 0.35)' : '1px solid transparent',
      transition: 'all 200ms ease',
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={100} height={100} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="9" />
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease' }}
            filter={`drop-shadow(0 0 6px ${color}80)`}
          />
          <text x="50" y="47" textAnchor="middle" fill={color} fontSize="17" fontWeight="900" fontFamily="JetBrains Mono, monospace">
            {score != null ? safeScore.toFixed(0) : '—'}
          </text>
          <text x="50" y="61" textAnchor="middle" fill="rgba(120,160,200,0.7)" fontSize="8.5" fontFamily="Inter, sans-serif">
            / 100
          </text>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 4 }}>
          Flight Safety Index
        </div>
        <div style={{
          fontSize: 12, fontWeight: 900, color,
          padding: '3px 10px',
          borderRadius: 14,
          background: `${color}15`,
          border: `1px solid ${color}40`,
          display: 'inline-block',
          letterSpacing: '0.8px',
        }}>
          {status}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
          Fuzzy Logic Engine Assessment
        </div>
      </div>
    </div>
  );
}

export default function TelemetryHUD({ drones = [], selectedDroneId, onDroneSelect, weather }) {
  // ── FILTER: ONLY DRONES CURRENTLY IN MOTION (STRICTLY UNIQUE BY ID) ──
  const motionDrones = useMemo(() => {
    const seen = new Set();
    return (drones || []).filter(d => {
      if (!d || !d.id || seen.has(d.id)) return false;
      const isInMotion =
        ['DELIVERING', 'RETURNING', 'IN_FLIGHT', 'RTB'].includes(d.status) ||
        (Number(d.speed_kmh) > 0 && d.status !== 'STANDBY' && d.status !== 'IDLE' && d.status !== 'PARACHUTE_DEPLOYED');
      if (isInMotion) {
        seen.add(d.id);
        return true;
      }
      return false;
    });
  }, [drones]);

  // Selected drone must be an active in-motion drone
  const selected = useMemo(() => {
    if (motionDrones.length === 0) return null;
    const found = motionDrones.find(d => d.id === selectedDroneId);
    return found || motionDrones[0];
  }, [motionDrones, selectedDroneId]);

  // ── 1. STANDBY EMPTY STATE (NO DRONES IN MOTION) ──
  if (motionDrones.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '24px 18px',
        background: 'rgba(8, 15, 31, 0.98)',
        color: 'var(--text-primary)',
        boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          fontWeight: 800,
          color: 'var(--brand-primary)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          marginBottom: 20,
        }}>
          <Activity size={14} /> Live Telemetry
        </div>

        {/* High-Tech Radar Scanning Display */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '20px 10px',
        }}>
          <div style={{
            position: 'relative',
            width: 110,
            height: 110,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 212, 255, 0.12) 0%, rgba(0, 212, 255, 0.02) 70%, transparent 100%)',
            border: '1.5px solid rgba(0, 212, 255, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            boxShadow: '0 0 25px rgba(0, 212, 255, 0.15)',
          }}>
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '1px dashed rgba(0, 212, 255, 0.25)',
              animation: 'spin 12s linear infinite',
            }} />
            <Radio size={36} color="var(--brand-primary)" style={{ opacity: 0.8 }} />
          </div>

          <div style={{
            fontSize: 13,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.5px',
            marginBottom: 6,
          }}>
            NO DRONES CURRENTLY IN MOTION
          </div>

          <div style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            maxWidth: 280,
            marginBottom: 20,
          }}>
            Live telemetry is strictly broadcast for airborne cargo drones in flight. All fleet units are currently grounded on launchpads at MMR Central Hub.
          </div>

          {/* Real-time Fleet Status Strip */}
          <div style={{
            width: '100%',
            background: 'rgba(5, 12, 24, 0.7)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '12px 14px',
            textAlign: 'left',
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
              Base Ground Telemetry
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>Fleet Airframes Available:</span>
              <span style={{ fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{drones.length} Units</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>Airborne In Motion:</span>
              <span style={{ fontWeight: 800, color: 'var(--brand-accent)', fontFamily: 'JetBrains Mono, monospace' }}>0 Units</span>
            </div>
            {weather && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                <span>Live Open-Meteo Weather:</span>
                <span style={{ fontWeight: 700, color: '#06ffa5' }}>
                  {weather.condition} ({weather.temperature_c}°C, {weather.wind_gust_ms} m/s)
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
              <span>WebSocket Stream Link:</span>
              <span style={{ fontWeight: 800, color: 'var(--brand-accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-accent)' }} /> 1 Hz Active
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. LIVE TELEMETRY STREAM FOR ACTIVE AIRBORNE DRONE ──
  const windSpeed = Number(selected.wind_gust_ms || 0);
  const batteryPct = Number(selected.battery_pct || 0);
  const fsiScore = Number(selected.fsi ?? 100);
  const actionStatus = selected.action_status || 'SAFE';

  // Condition checks
  const isHighWind = windSpeed > 15;
  const isExtremeWind = windSpeed > 20;
  const isLowBattery = batteryPct < 25;
  const isCriticalBattery = batteryPct < 18;
  const isLowFSI = fsiScore < 40;
  const isCriticalAction = actionStatus === 'CRITICAL' || actionStatus === 'EMERGENCY_RTB';
  const isEmergencyRTB = selected.status === 'RTB' || selected.emergency_rtb === true;
  const isNormalReturning = selected.status === 'RETURNING' && !isEmergencyRTB;
  const isRTB = isEmergencyRTB;
  const isParachuted = selected.status === 'PARACHUTE_DEPLOYED';

  // Altitude specific checks (Standard DGCA Green Zone ceiling is 120m / 400ft)
  const altValue = Number(selected.altitude_m || 0);
  const isHighAltitude = altValue > 120;
  const isCriticalAltitude = altValue > 150;
  const isLowAltitudeHazard = ['DELIVERING', 'IN_FLIGHT'].includes(selected.status) && altValue > 0 && altValue < 25;

  // ── RAIN / PRECIPITATION from live weather ──
  const precipMm = typeof weather?.precipitation_mm === 'number' ? weather.precipitation_mm : 0;
  const isLightRain = precipMm > 0 && precipMm < 2;
  const isModRain = precipMm >= 2 && precipMm < 7.5;
  const isHeavyRain = precipMm >= 7.5 && precipMm < 15;
  const isViolentRain = precipMm >= 15;
  const hasRainHazard = isHeavyRain || isViolentRain;

  // UNRESOLVED hazard: Requires pilot action ONLY if NOT already returning or parachuted
  const hasHazard = !isRTB && !isNormalReturning && !isParachuted && (isHighWind || isLowBattery || isLowFSI || isCriticalAction || isCriticalAltitude || hasRainHazard);

  // Dynamic colors: Each gauge responds to its own physical threshold (Wind > 10 m/s caution, > 15 m/s hazard)
  const windColor = isHighWind ? '#ff3d57' : windSpeed > 10.0 ? '#fbbf24' : '#06ffa5';
  const altColor = isCriticalAltitude || isLowAltitudeHazard
    ? '#ff3d57'
    : isHighAltitude
      ? '#fbbf24'
      : 'var(--brand-primary)';
  const maxSpd = Number(selected.max_speed_kmh) || 85;

  // ── RAIN-ADJUSTED OPTIMALITY PENALTY ──
  // Derive a 0-100 weather optimality score (100 = perfect flying conditions)
  const rainPenalty = isViolentRain ? 60 : isHeavyRain ? 40 : isModRain ? 20 : isLightRain ? 8 : 0;
  const windPenalty = isExtremeWind ? 35 : isHighWind ? 20 : windSpeed > 10 ? 8 : 0;
  const weatherOptimality = Math.max(0, 100 - rainPenalty - windPenalty);
  const weatherOptColor = weatherOptimality >= 80 ? '#06ffa5' : weatherOptimality >= 50 ? '#fbbf24' : '#ff9f43';

  // Build specific issue messages
  const issueMessages = [];
  if (isHighWind) issueMessages.push(`High Wind Gust (${windSpeed.toFixed(1)} m/s > 15 m/s)`);
  if (isLowBattery) issueMessages.push(`Critical Battery (${batteryPct.toFixed(1)}% < 25%)`);
  if (isLowFSI) issueMessages.push(`Flight Safety Alert (FSI ${fsiScore.toFixed(0)}/100)`);
  if (isCriticalAltitude) issueMessages.push(`Altitude Ceiling Breach (${altValue.toFixed(0)} m > 150 m)`);
  if (isLowAltitudeHazard) issueMessages.push(`Terrain Proximity Risk (${altValue.toFixed(0)} m < 25 m)`);
  if (actionStatus === 'CRITICAL') issueMessages.push(`Fuzzy Logic Critical Abort Signal`);
  if (actionStatus === 'REROUTE_RECOMMENDED') issueMessages.push(`FSI Caution: Weather/Distance Reroute Advised`);
  if (isViolentRain) issueMessages.push(`⛈ Violent Rain (${precipMm.toFixed(1)} mm/h) — Ground Mission`);
  else if (isHeavyRain) issueMessages.push(`🌧 Heavy Rain (${precipMm.toFixed(1)} mm/h) — Consider RTB`);
  else if (isModRain) issueMessages.push(`🌦 Moderate Rain (${precipMm.toFixed(1)} mm/h) — Reduce Speed`);
  else if (isLightRain) issueMessages.push(`🌂 Light Rain (${precipMm.toFixed(1)} mm/h) — Monitor`);
  if (weatherOptimality < 60 && weatherOptimality >= 40) issueMessages.push(`Weather Optimality Low: ${weatherOptimality.toFixed(0)}%`);
  if (weatherOptimality < 40) issueMessages.push(`⚠ Critical Weather Optimality: ${weatherOptimality.toFixed(0)}%`);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflowY: 'auto',
      background: hasHazard
        ? 'radial-gradient(circle at 50% 0%, rgba(255, 61, 87, 0.18) 0%, rgba(8, 15, 31, 0.98) 65%)'
        : isRTB
          ? 'radial-gradient(circle at 50% 0%, rgba(251, 191, 36, 0.12) 0%, rgba(8, 15, 31, 0.98) 65%)'
          : 'rgba(8, 15, 31, 0.98)',
      color: 'var(--text-primary)',
      border: hasHazard
        ? '1.5px solid rgba(255, 61, 87, 0.75)'
        : isRTB
          ? '1.5px solid rgba(251, 191, 36, 0.6)'
          : '1px solid rgba(0, 212, 255, 0.12)',
      boxShadow: hasHazard
        ? '0 0 24px rgba(255, 61, 87, 0.25) inset'
        : isRTB
          ? '0 0 20px rgba(251, 191, 36, 0.15) inset'
          : 'none',
      transition: 'all 240ms ease',
      boxSizing: 'border-box',
    }}>

      {/* ── DRONES IN MOTION SELECTOR ── */}
      <div className="panel-section" style={{
        padding: '10px 14px',
        borderBottom: hasHazard
          ? '1px solid rgba(255, 61, 87, 0.3)'
          : isRTB
            ? '1px solid rgba(251, 191, 36, 0.3)'
            : '1px solid var(--border-subtle)',
      }}>
        {/* Tab Buttons for ONLY in-motion drones */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {motionDrones.map(d => {
            const isDeliv = ['IN_FLIGHT', 'DELIVERING'].includes(d.status);
            const isCurrent = d.id === selected.id;
            const droneHasHazard = (d.wind_gust_ms > 15) || (d.battery_pct < 25) || (d.fsi < 40) || d.action_status === 'CRITICAL';
            const droneIsEmergencyRtb = d.status === 'RTB' || d.emergency_rtb === true;
            const droneIsNormalReturning = d.status === 'RETURNING' && !droneIsEmergencyRtb;

            const droneIsRed = droneHasHazard || droneIsEmergencyRtb;
            const droneIsYellow = !droneIsRed && (d.battery_pct < 50 || d.fsi < 65 || d.wind_gust_ms > 10);
            const tabColor = droneIsRed ? '#ff3d57' : droneIsYellow ? '#fbbf24' : isDeliv || droneIsNormalReturning ? 'var(--brand-primary)' : '#06ffa5';

            return (
              <button
                key={d.id}
                type="button"
                className={`btn btn-ghost btn-sm ${isCurrent ? 'active' : ''}`}
                onClick={() => onDroneSelect(d.id)}
                id={`telemetry-tab-${d.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  borderColor: isCurrent ? tabColor : droneIsRed ? 'rgba(255,61,87,0.4)' : droneIsYellow ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)',
                  color: isCurrent ? tabColor : droneIsRed ? '#ff3d57' : droneIsYellow ? '#fbbf24' : 'var(--text-secondary)',
                  background: isCurrent ? `${tabColor}15` : 'transparent',
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: droneIsRed ? '#ff3d57' : droneIsYellow ? '#fbbf24' : 'var(--brand-accent)',
                  boxShadow: droneIsRed ? '0 0 6px #ff3d57' : droneIsYellow ? '0 0 6px #fbbf24' : 'none',
                }} />
                {d.id}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── UNRESOLVED HAZARD ALERT BANNER (Only when pilot action is needed) ── */}
      {hasHazard && (
        <div style={{
          margin: '10px 14px 4px',
          padding: '12px 14px',
          borderRadius: 10,
          background: 'rgba(255, 61, 87, 0.16)',
          border: '1.5px solid rgba(255, 61, 87, 0.75)',
          boxShadow: '0 0 20px rgba(255, 61, 87, 0.25)',
          animation: 'pulse 2s infinite',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#ff3d57', fontWeight: 900, fontSize: 11.5, letterSpacing: '0.4px' }}>
            <AlertOctagon size={16} />
            <span>FLIGHT HAZARD DETECTED — ACTION ADVISED</span>
          </div>
          <div style={{ fontSize: 10.5, color: '#fff', marginTop: 4, lineHeight: 1.4, fontWeight: 600 }}>
            {issueMessages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: '#ff3d57' }}>•</span> {msg}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            Threshold breached. Autonomous flight safety monitor alerting ground control.
          </div>
        </div>
      )}

      {/* ── RETURNING & RTB IN-PROGRESS BANNER ── */}
      {(isEmergencyRTB || isNormalReturning) && !isParachuted && (
        <div style={{
          margin: '10px 14px 4px',
          padding: '12px 14px',
          borderRadius: 10,
          background: isEmergencyRTB ? 'rgba(255, 61, 87, 0.12)' : 'rgba(0, 212, 255, 0.12)',
          border: `1.5px solid ${isEmergencyRTB ? 'rgba(255, 61, 87, 0.65)' : 'rgba(0, 212, 255, 0.65)'}`,
          boxShadow: `0 0 16px ${isEmergencyRTB ? 'rgba(255, 61, 87, 0.2)' : 'rgba(0, 212, 255, 0.2)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: isEmergencyRTB ? '#ff3d57' : '#00d4ff', fontWeight: 900, fontSize: 11.5, letterSpacing: '0.4px' }}>
            <RefreshCw size={14} className="spin" style={{ animation: 'spin 3s linear infinite' }} />
            <span>{isEmergencyRTB ? '🚨 EMERGENCY RTB ENGAGED (MISSION ABORTED)' : '🔄 RETURNING TO HUB (MISSION COMPLETED)'}</span>
          </div>
          <div style={{ fontSize: 10.5, color: '#fff', marginTop: 4, lineHeight: 1.4, fontWeight: 600 }}>
            {isEmergencyRTB
              ? 'Pilot emergency abort executed. Drone is navigating back to MMR Central Hub via A* optimal safe corridor.'
              : 'Package delivered successfully. Drone is navigating back to MMR Central Hub launchpad.'}
          </div>
          <div style={{ fontSize: 9.5, color: isEmergencyRTB ? '#ff3d57' : 'rgba(0, 212, 255, 0.85)', marginTop: 4 }}>
            Destination: MMR Central Hub • Altitude & Corridor Protected
          </div>
        </div>
      )}

      {/* ── PARACHUTE DEPLOYED HALT BANNER ── */}
      {isParachuted && (
        <div style={{
          margin: '10px 14px 4px',
          padding: '12px 14px',
          borderRadius: 10,
          background: 'rgba(255, 61, 87, 0.15)',
          border: '1.5px solid rgba(255, 61, 87, 0.8)',
          boxShadow: '0 0 20px rgba(255, 61, 87, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#ff3d57', fontWeight: 900, fontSize: 11.5, letterSpacing: '0.4px' }}>
            <AlertOctagon size={16} />
            <span>EMERGENCY PARACHUTE DEPLOYED — HALTED</span>
          </div>
          <div style={{ fontSize: 10.5, color: '#fff', marginTop: 4, lineHeight: 1.4, fontWeight: 600 }}>
            Propulsion frozen. Emergency drop completed. Marker halted black on map.
          </div>
          <div style={{
            fontSize: 11,
            color: '#ff3d57',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 800,
            marginTop: 6,
            background: 'rgba(0,0,0,0.4)',
            padding: '4px 8px',
            borderRadius: 6,
            display: 'inline-block',
          }}>
            📍 Coordinates: {selected.lat != null ? Number(selected.lat).toFixed(5) : '—'}, {selected.lng != null ? Number(selected.lng).toFixed(5) : '—'}
          </div>
        </div>
      )}

      {/* ── DRONE IDENTITY & STATUS ── */}
      <div className="panel-section" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{
              fontSize: 17,
              fontWeight: 900,
              color: hasHazard ? '#ff3d57' : isRTB ? '#fbbf24' : '#fff',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {selected.id}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{selected.model}</div>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20,
            background: hasHazard
              ? 'rgba(255,61,87,0.2)'
              : isRTB
                ? 'rgba(251,191,36,0.18)'
                : 'rgba(0,212,255,0.15)',
            border: hasHazard
              ? '1px solid rgba(255,61,87,0.5)'
              : isRTB
                ? '1px solid rgba(251,191,36,0.5)'
                : '1px solid rgba(0,212,255,0.4)',
            color: hasHazard ? '#ff3d57' : isRTB ? '#fbbf24' : 'var(--brand-primary)',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {isParachuted ? '⛑️ PARACHUTE' : isRTB ? '🏠 RETURNING (RTB)' : selected.status || 'AIRBORNE'}
          </span>
        </div>

        {/* Real FSI Ring */}
        <FSIRing score={selected.fsi} isAlert={hasHazard} />

        {/* Active Mission Card */}
        {selected.order_id && selected.order_id !== 'STANDBY' && (
          <div style={{
            background: hasHazard
              ? 'rgba(255, 61, 87, 0.08)'
              : isRTB
                ? 'rgba(251, 191, 36, 0.08)'
                : 'rgba(0, 212, 255, 0.06)',
            border: hasHazard
              ? '1px solid rgba(255, 61, 87, 0.3)'
              : isRTB
                ? '1px solid rgba(251, 191, 36, 0.3)'
                : '1px solid rgba(0, 212, 255, 0.25)',
            borderRadius: 8,
            padding: '8px 10px',
            marginTop: 10,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', fontSize: 10,
              color: hasHazard ? '#ff3d57' : isRTB ? '#fbbf24' : 'var(--brand-primary)',
              fontWeight: 800, marginBottom: 2,
            }}>
              <span>📦 MISSION: {selected.order_id}</span>
              {selected.payload_kg > 0 && <span style={{ color: 'var(--text-secondary)' }}>{selected.payload_kg} kg</span>}
            </div>
            <div style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>
              ➔ {isRTB ? 'MMR Central Hub (Return Approach)' : selected.destination_name || 'En Route'}
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
              Agent: {selected.agent_name || 'Logistics Officer'}
            </div>
          </div>
        )}
      </div>

      {/* ── BATTERY SECTION ── */}
      <div className="panel-section" style={{ padding: '10px 14px' }}>
        <BatteryBar pct={selected.battery_pct} />
      </div>

      {/* ── 3 GAUGES: WIND, ALTITUDE, RAIN/PRECIP (LIVE WEATHER) ── */}
      <div className="panel-section" style={{ padding: '10px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <ArcGauge
            value={selected.wind_gust_ms}
            max={25}
            color={windColor}
            label="Wind Gust"
            unit="m/s"
            isAlert={isHighWind}
          />
          <ArcGauge
            value={selected.altitude_m}
            max={200}
            color={altColor}
            label="Altitude"
            unit="m"
            isAlert={isCriticalAltitude || isLowAltitudeHazard}
          />
          <RainGauge
            precipMm={precipMm}
            condition={weather?.condition || 'N/A'}
          />
        </div>
      </div>

      {/* ── WEATHER FLIGHT OPTIMALITY ── */}
      <div className="panel-section" style={{ padding: '8px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CloudRain size={11} style={{ color: weatherOptColor }} /> Weather Flight Optimality
          </span>
          <span style={{ fontSize: 12, fontWeight: 900, color: weatherOptColor, fontFamily: 'JetBrains Mono, monospace' }}>
            {weatherOptimality.toFixed(0)}%
          </span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${weatherOptimality}%`,
            height: '100%',
            background: weatherOptColor,
            borderRadius: 4,
            boxShadow: `0 0 8px ${weatherOptColor}60`,
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
        {weather && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9.5, color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Droplets size={9} style={{ color: precipMm > 0 ? '#22d3ee' : 'var(--text-muted)' }} />
              {weather.condition}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              {precipMm > 0 ? `${precipMm.toFixed(1)} mm/h · ` : ''}{weather.humidity_pct}% RH
            </span>
          </div>
        )}
      </div>

      {/* ── LIVE GPS POSITION & HEADING (REAL SENSOR DATA) ── */}
      <div className="panel-section" style={{ padding: '10px 14px' }}>
        <div className="panel-title" style={{ marginBottom: 8 }}><Gauge size={12} /> Live Flight Coordinates</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { label: 'Latitude', value: selected.lat != null ? Number(selected.lat).toFixed(5) : '—', unit: '°N' },
            { label: 'Longitude', value: selected.lng != null ? Number(selected.lng).toFixed(5) : '—', unit: '°E' },
            { label: 'Compass Heading', value: selected.heading_deg != null ? Number(selected.heading_deg).toFixed(0) : '—', unit: '°' },
            { label: 'Wind Vector', value: selected.wind_gust_ms != null ? Number(selected.wind_gust_ms).toFixed(1) : '—', unit: 'm/s', alert: isHighWind },
          ].map(item => (
            <div key={item.label} className="metric-card" style={{
              background: item.alert ? 'rgba(255, 61, 87, 0.1)' : 'rgba(5, 12, 24, 0.6)',
              border: item.alert ? '1px solid rgba(255, 61, 87, 0.4)' : '1px solid var(--border-subtle)',
              padding: '6px 10px',
            }}>
              <div className="metric-label" style={{ fontSize: 9, color: item.alert ? '#ff3d57' : 'var(--text-muted)' }}>{item.label}</div>
              <div className="metric-value" style={{
                fontSize: 13,
                color: item.alert ? '#ff3d57' : 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {item.value}
                <span style={{ fontSize: 9.5, fontWeight: 400, opacity: 0.6, marginLeft: 2 }}>{item.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FUZZY LOGIC ACTION STATUS BANNER ── */}
      {selected.action_status && (
        <div className="panel-section" style={{ padding: '10px 14px' }}>
          <div style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: hasHazard
              ? 'rgba(255,61,87,0.12)'
              : isRTB
                ? 'rgba(251,191,36,0.1)'
                : selected.action_status === 'SAFE'
                  ? 'rgba(6,255,165,0.08)'
                  : 'rgba(251,191,36,0.1)',
            border: `1.5px solid ${hasHazard
              ? 'rgba(255,61,87,0.5)'
              : isRTB
                ? 'rgba(251,191,36,0.4)'
                : selected.action_status === 'SAFE'
                  ? 'rgba(6,255,165,0.3)'
                  : 'rgba(251,191,36,0.3)'
              }`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            {hasHazard ? (
              <AlertTriangle size={18} color="#ff3d57" />
            ) : isRTB ? (
              <RefreshCw size={16} color="var(--brand-warning)" />
            ) : selected.action_status === 'SAFE' ? (
              <Shield size={16} color="var(--brand-accent)" />
            ) : (
              <AlertTriangle size={16} color="var(--brand-warning)" />
            )}
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.8px',
                color: hasHazard
                  ? '#ff3d57'
                  : isRTB
                    ? 'var(--brand-warning)'
                    : selected.action_status === 'SAFE'
                      ? 'var(--brand-accent)'
                      : 'var(--brand-warning)',
              }}>
                {hasHazard ? 'HAZARD INTERVENTION REQUIRED' : isRTB ? 'EMERGENCY RTB ENGAGED' : selected.action_status.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                {isRTB ? 'Autonomous Return Flight Mode Enabled' : 'Fuzzy Inference Engine Real-Time Evaluation'}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
