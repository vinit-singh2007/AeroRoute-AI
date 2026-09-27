// AeroRoute — Fleet Overview Sidebar
import { useMemo } from 'react';
import { Zap, Wind, Navigation, AlertTriangle } from 'lucide-react';

function DroneCard({ drone, isSelected, onClick }) {
  const batteryLevel =
    drone.battery_pct > 50 ? 'high' :
    drone.battery_pct > 25 ? 'medium' : 'low';

  const batteryColor =
    drone.battery_pct > 50 ? 'var(--brand-accent)' :
    drone.battery_pct > 25 ? 'var(--brand-warning)' :
    'var(--brand-danger)';

  const fsiColor =
    drone.fsi >= 65 ? 'var(--brand-accent)' :
    drone.fsi >= 35 ? 'var(--brand-warning)' :
    'var(--brand-danger)';

  return (
    <div
      className={`drone-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      id={`fleet-card-${drone.id}`}
    >
      <div className="drone-avatar">🚁</div>
      <div className="drone-info">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="drone-id">{drone.id}</div>
          <span className={`status-chip ${drone.status}`}>{drone.status}</span>
        </div>
        <div className="drone-model">{drone.model}</div>

        {/* Assigned Delivery Mission Tag */}
        {drone.order_id && drone.order_id !== 'STANDBY' && (
          <div style={{
            fontSize: 9,
            color: 'var(--brand-accent)',
            background: 'rgba(6,255,165,0.08)',
            border: '1px solid rgba(6,255,165,0.25)',
            borderRadius: 4,
            padding: '2px 5px',
            marginTop: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            📦 {drone.order_id} ➔ {drone.destination_name}
          </div>
        )}

        {/* Battery bar */}
        <div style={{ marginTop: 6 }}>
          <div className="battery-bar-wrap" style={{ height: 4 }}>
            <div
              className={`battery-bar-fill ${batteryLevel}`}
              style={{ width: `${drone.battery_pct}%` }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            <span style={{ fontSize: 10, color: batteryColor, fontFamily: 'JetBrains Mono, monospace' }}>
              <Zap size={8} style={{ marginRight: 2 }} />{drone.battery_pct?.toFixed(0)}%
            </span>
            <span style={{ fontSize: 10, color: fsiColor, fontFamily: 'JetBrains Mono, monospace' }}>
              FSI {drone.fsi?.toFixed(0)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              <Wind size={8} style={{ marginRight: 2 }} />{drone.wind_gust_ms?.toFixed(1)} m/s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FleetOverview({ drones, selectedDroneId, onDroneSelect }) {
  const stats = useMemo(() => {
    if (!drones.length) return null;
    const delivering = drones.filter(d => d.status === 'DELIVERING').length;
    const returning  = drones.filter(d => d.status === 'RETURNING').length;
    const rtb        = drones.filter(d => d.status === 'RTB').length;
    const avgBattery = drones.reduce((s, d) => s + d.battery_pct, 0) / drones.length;
    const alerts     = drones.filter(d => d.action_status !== 'SAFE').length;
    return { delivering, returning, rtb, avgBattery, alerts };
  }, [drones]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Fleet Stats */}
      {stats && (
        <div className="panel-section">
          <div className="panel-title"><Navigation size={12} /> Fleet Status</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
            {[
              { label: 'Delivering', value: stats.delivering, color: 'var(--brand-primary)' },
              { label: 'Returning',  value: stats.returning,  color: 'var(--brand-warning)' },
              { label: 'RTB',        value: stats.rtb,        color: 'var(--brand-danger)'  },
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(8,15,31,0.7)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: '8px 6px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{ background: 'rgba(8,15,31,0.6)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, letterSpacing: '0.5px' }}>AVG BATTERY</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-accent)', fontFamily: 'JetBrains Mono, monospace' }}>
                {stats.avgBattery.toFixed(1)}%
              </div>
            </div>
            {stats.alerts > 0 ? (
              <div style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.3)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} color="var(--brand-danger)" />
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,61,87,0.7)', letterSpacing: '0.5px' }}>ALERTS</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-danger)', fontFamily: 'JetBrains Mono, monospace' }}>{stats.alerts}</div>
                </div>
              </div>
            ) : (
              <div style={{ background: 'rgba(6,255,165,0.06)', border: '1px solid rgba(6,255,165,0.2)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, letterSpacing: '0.5px' }}>ALERTS</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-accent)', fontFamily: 'JetBrains Mono, monospace' }}>None</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drone List */}
      <div className="panel-section">
        <div className="panel-title">Active Drones ({drones.length})</div>
        <div className="drone-list">
          {drones.map(drone => (
            <DroneCard
              key={drone.id}
              drone={drone}
              isSelected={drone.id === selectedDroneId}
              onClick={() => onDroneSelect(drone.id)}
            />
          ))}
          {drones.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24, fontSize: 13 }}>
              No drones connected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
