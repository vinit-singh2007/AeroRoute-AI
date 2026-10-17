// AeroRoute — Dedicated 3D Real-World Drone Tracking Viewport
// Powered by CesiumJS with Google Photorealistic 3D Tiles
import { useEffect, useRef, useState, useMemo } from 'react';
import * as Cesium from 'cesium';
import {
  ArrowLeft,
  Navigation,
  Compass,
  Zap,
  Battery,
  Shield,
  Layers,
  Key,
  Play,
  Pause,
  RotateCw,
  Plus,
  Minus,
  Maximize2,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Radio,
  MapPin,
  Clock,
  ExternalLink
} from 'lucide-react';

// Exact MMR Central Logistics Base configured in the project
const MMR_BASE = {
  id: 'hub-mmr',
  name: 'MMR Central Logistics Base',
  lat: 19.1940,
  lng: 72.8550,
  alt: 15,
};

// Haversine formula to compute live ground distance to base
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function CesiumDroneTracker({
  drone,
  onClose,
  allDrones = [],
  onSelectDrone,
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const droneEntityRef = useRef(null);
  const dropLineEntityRef = useRef(null);
  const routeEntityRef = useRef(null);

  // API Key state: reads from Vite env or user input
  const defaultApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [apiKey, setApiKey] = useState(defaultApiKey);
  const [inputKey, setInputKey] = useState(defaultApiKey);
  const [tilesetStatus, setTilesetStatus] = useState('loading'); // 'loading' | 'active' | 'missing-key' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Live vs Simulated Flight
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0); // 0 to 1 along route to base
  const [followDrone, setFollowDrone] = useState(true);

  // Current Drone Coordinates & Metrics (synced from prop or simulation)
  const currentLat = useMemo(() => {
    if (!drone) return 19.223;
    if (isSimulating) {
      return drone.lat + (MMR_BASE.lat - drone.lat) * simProgress;
    }
    return drone.lat || 19.223;
  }, [drone, isSimulating, simProgress]);

  const currentLng = useMemo(() => {
    if (!drone) return 72.848;
    if (isSimulating) {
      return drone.lng + (MMR_BASE.lng - drone.lng) * simProgress;
    }
    return drone.lng || 72.848;
  }, [drone, isSimulating, simProgress]);

  const currentAlt = useMemo(() => {
    if (!drone) return 86;
    if (isSimulating) {
      return Math.max(30, (drone.altitude_m || 86) * (1 - simProgress * 0.7));
    }
    return drone.altitude_m || drone.altitude || 86;
  }, [drone, isSimulating, simProgress]);

  const currentBattery = useMemo(() => {
    if (!drone) return 5;
    if (isSimulating) {
      return Math.max(1, (drone.battery_pct || 5) * (1 - simProgress * 0.4));
    }
    return drone.battery_pct !== undefined ? drone.battery_pct : 5;
  }, [drone, isSimulating, simProgress]);

  const currentSpeed = useMemo(() => {
    if (!drone) return 62;
    if (isSimulating) {
      return simProgress > 0.95 ? 12 : 62;
    }
    return drone.speed_kmh || (drone.speed_ms ? Math.round(drone.speed_ms * 3.6) : 62);
  }, [drone, isSimulating, simProgress]);

  const distToBaseKm = useMemo(() => {
    return calculateDistanceKm(currentLat, currentLng, MMR_BASE.lat, MMR_BASE.lng);
  }, [currentLat, currentLng]);

  const etaMinutes = useMemo(() => {
    if (currentSpeed <= 0) return 0;
    return (distToBaseKm / currentSpeed) * 60;
  }, [distToBaseKm, currentSpeed]);

  // ─────────────────────────────────────────────────────────────
  // 1. INITIALIZE CESIUM VIEWER
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    // Set Cesium base URL for static assets/workers
    if (typeof window !== 'undefined') {
      window.CESIUM_BASE_URL = window.CESIUM_BASE_URL || 'https://cdn.jsdelivr.net/npm/cesium@1.146.0/Build/Cesium/';
    }

    // Initialize Cesium Ion if token present
    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken;
    }

    // Create high-performance Cesium Viewer
    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      scene3DOnly: true,
      shouldAnimate: true,
    });

    viewerRef.current = viewer;

    // Atmospheric & Lighting configuration for dark tactical aesthetic
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.highDynamicRange = true;

    // Clean up Cesium default credits widget placement
    const creditContainer = viewer.bottomContainer;
    if (creditContainer) {
      creditContainer.style.fontSize = '10px';
      creditContainer.style.opacity = '0.7';
    }

    // ─────────────────────────────────────────────────────────
    // 2. LOAD GOOGLE PHOTOREALISTIC 3D TILES
    // ─────────────────────────────────────────────────────────
    let tilesetPrimitive = null;

    async function load3DTiles() {
      setTilesetStatus('loading');
      setErrorMessage('');

      if (!apiKey || !apiKey.trim()) {
        setTilesetStatus('missing-key');
        return;
      }

      try {
        // Official Google Photorealistic 3D Tiles integration
        tilesetPrimitive = await Cesium.createGooglePhotorealistic3DTileset({
          key: apiKey.trim(),
        });

        viewer.scene.primitives.add(tilesetPrimitive);
        setTilesetStatus('active');
      } catch (err) {
        console.error('Cesium 3D Tiles Error:', err);
        setTilesetStatus('error');
        setErrorMessage(err.message || 'Failed to authenticate Google Maps 3D Tileset');
      }
    }

    load3DTiles();

    // ─────────────────────────────────────────────────────────
    // 3. ADD RETURN BASE (MMR CENTRAL LOGISTICS BASE) ENTITY
    // ─────────────────────────────────────────────────────────
    const basePosition = Cesium.Cartesian3.fromDegrees(MMR_BASE.lng, MMR_BASE.lat, MMR_BASE.alt);
    viewer.entities.add({
      id: 'base-marker',
      name: MMR_BASE.name,
      position: basePosition,
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#06ffa5'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `🏢 ${MMR_BASE.name}\n(Return Hub: 19.194°N, 72.855°E)`,
        font: '11px "JetBrains Mono", monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.fromCssColorString('#06ffa5'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    // ─────────────────────────────────────────────────────────
    // 4. ADD INITIAL DRONE & ROUTE ENTITIES
    // ─────────────────────────────────────────────────────────
    const initDronePos = Cesium.Cartesian3.fromDegrees(currentLng, currentLat, currentAlt);

    // Drop line connecting drone altitude to ground level
    dropLineEntityRef.current = viewer.entities.add({
      id: 'drone-dropline',
      polyline: {
        positions: [
          Cesium.Cartesian3.fromDegrees(currentLng, currentLat, 0),
          initDronePos,
        ],
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('rgba(0, 212, 255, 0.75)'),
          dashLength: 12,
        }),
      },
    });

    // Main 3D Drone Entity with glowing point & callout
    droneEntityRef.current = viewer.entities.add({
      id: 'active-drone',
      name: drone?.id || 'BOM-001',
      position: initDronePos,
      point: {
        pixelSize: 18,
        color: Cesium.Color.fromCssColorString(drone?.status === 'RTB' ? '#ff3d57' : '#00d4ff'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `🚁 ${drone?.id || 'BOM-001'} [${drone?.status || 'RTB'}]\nAlt: ${currentAlt.toFixed(0)}m • Spd: ${currentSpeed}km/h`,
        font: '12px "JetBrains Mono", monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -22),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    // Flight Path to MMR Central Base
    routeEntityRef.current = viewer.entities.add({
      id: 'rtb-flight-route',
      name: 'Return Flight Path',
      polyline: {
        positions: [initDronePos, basePosition],
        width: 4,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.35,
          color: Cesium.Color.fromCssColorString(drone?.status === 'RTB' ? '#ff3d57' : '#00d4ff'),
        }),
      },
    });

    // Fly camera smoothly to drone
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(currentLng, currentLat - 0.004, currentAlt + 280),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0.0,
      },
      duration: 1.8,
    });

    // Cleanup when unmounting
    return () => {
      if (tilesetPrimitive && viewer.scene.primitives.contains(tilesetPrimitive)) {
        viewer.scene.primitives.remove(tilesetPrimitive);
      }
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, [apiKey]); // Re-initialize if API key changes

  // ─────────────────────────────────────────────────────────────
  // 5. SYNCHRONIZE DRONE POSITION IN CESIUM SCENE
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const newPos = Cesium.Cartesian3.fromDegrees(currentLng, currentLat, currentAlt);
    const basePos = Cesium.Cartesian3.fromDegrees(MMR_BASE.lng, MMR_BASE.lat, MMR_BASE.alt);

    // Update drone point & label
    if (droneEntityRef.current) {
      droneEntityRef.current.position = newPos;
      if (droneEntityRef.current.label) {
        droneEntityRef.current.label.text = `🚁 ${drone?.id || 'BOM-001'} [${drone?.status || 'RTB'}]\nAlt: ${currentAlt.toFixed(0)}m • Spd: ${currentSpeed}km/h`;
      }
    }

    // Update drop line
    if (dropLineEntityRef.current && dropLineEntityRef.current.polyline) {
      dropLineEntityRef.current.polyline.positions = [
        Cesium.Cartesian3.fromDegrees(currentLng, currentLat, 0),
        newPos,
      ];
    }

    // Update route polyline
    if (routeEntityRef.current && routeEntityRef.current.polyline) {
      routeEntityRef.current.polyline.positions = [newPos, basePos];
    }

    // Camera follow mode
    if (followDrone) {
      viewer.camera.lookAt(
        newPos,
        new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(0),
          Cesium.Math.toRadians(-35),
          380
        )
      );
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }
  }, [currentLat, currentLng, currentAlt, currentSpeed, followDrone, drone?.id, drone?.status]);

  // ─────────────────────────────────────────────────────────────
  // 6. SIMULATION ANIMATION LOOP
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setSimProgress((prev) => {
        if (prev >= 1) {
          setIsSimulating(false);
          return 1;
        }
        return Math.min(1, prev + 0.008);
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // ─────────────────────────────────────────────────────────────
  // 7. CAMERA NAVIGATION CONTROLS
  // ─────────────────────────────────────────────────────────────
  const handleZoom = (amount) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (amount > 0) {
      viewer.camera.zoomIn(120);
    } else {
      viewer.camera.zoomOut(120);
    }
  };

  const handleResetCamera = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    setFollowDrone(true);
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(currentLng, currentLat - 0.004, currentAlt + 320),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0.0,
      },
      duration: 1.2,
    });
  };

  const handleTilt = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const currentPitch = Cesium.Math.toDegrees(viewer.camera.pitch);
    const newPitch = currentPitch < -60 ? -30 : -85;
    viewer.camera.flyTo({
      destination: viewer.camera.position,
      orientation: {
        heading: viewer.camera.heading,
        pitch: Cesium.Math.toRadians(newPitch),
        roll: 0.0,
      },
      duration: 0.8,
    });
  };

  const handleApplyKey = (e) => {
    e.preventDefault();
    if (!inputKey.trim()) return;
    setApiKey(inputKey.trim());
    setShowKeyModal(false);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      background: '#030a17',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* ── TOP HUD HEADER: Navigation & Status ── */}
      <div style={{
        height: 56,
        padding: '0 20px',
        background: 'rgba(5, 12, 24, 0.95)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(16px)',
        zIndex: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
      }}>
        {/* Left: Back to Fleet & Drone Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={onClose}
            id="btn-return-dashboard"
            title="Return to Fleet Dashboard"
            style={{
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.45)',
              borderRadius: 6,
              padding: '6px 12px',
              color: 'var(--brand-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              fontWeight: 800,
              transition: 'all 120ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 212, 255, 0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)'}
          >
            <ArrowLeft size={14} />
            <span>EXIT 3D VIEW</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
              {drone?.id || 'BOM-001'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              • {drone?.model || 'Phantom-Mumbai X7'}
            </span>
            <span style={{
              fontSize: 9.5,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 12,
              background: drone?.status === 'RTB' ? 'rgba(255, 61, 87, 0.2)' : 'rgba(0, 212, 255, 0.2)',
              border: drone?.status === 'RTB' ? '1px solid #ff3d57' : '1px solid var(--brand-primary)',
              color: drone?.status === 'RTB' ? '#ff3d57' : 'var(--brand-primary)',
            }}>
              {drone?.status || 'RTB (Return to Base)'}
            </span>
          </div>
        </div>

        {/* Center: Reusable Drone Switcher (if multiple drones present) */}
        {allDrones.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              FLEET:
            </span>
            {allDrones.map(d => (
              <button
                key={d.id}
                onClick={() => onSelectDrone?.(d.id)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: d.id === drone?.id ? '1px solid var(--brand-primary)' : '1px solid rgba(255,255,255,0.1)',
                  background: d.id === drone?.id ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.03)',
                  color: d.id === drone?.id ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {d.id}
              </button>
            ))}
          </div>
        )}

        {/* Right: Photorealistic 3D Tiles Status & Key Config */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            onClick={() => setShowKeyModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 6,
              background: tilesetStatus === 'active'
                ? 'rgba(6, 255, 165, 0.12)'
                : tilesetStatus === 'missing-key'
                ? 'rgba(251, 191, 36, 0.15)'
                : 'rgba(255, 61, 87, 0.15)',
              border: tilesetStatus === 'active'
                ? '1px solid rgba(6, 255, 165, 0.4)'
                : tilesetStatus === 'missing-key'
                ? '1px solid rgba(251, 191, 36, 0.4)'
                : '1px solid rgba(255, 61, 87, 0.4)',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 800,
              color: tilesetStatus === 'active' ? '#06ffa5' : tilesetStatus === 'missing-key' ? '#fbbf24' : '#ff3d57',
            }}
            title="Click to configure Google Maps Platform 3D Tiles API Key"
          >
            <Key size={12} />
            <span>
              {tilesetStatus === 'active'
                ? 'GOOGLE 3D TILES ACTIVE'
                : tilesetStatus === 'missing-key'
                ? '3D TILES: API KEY NEEDED'
                : '3D TILES: ERROR'}
            </span>
          </div>

          <button
            onClick={() => {
              setIsSimulating(!isSimulating);
              if (simProgress >= 1) setSimProgress(0);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 6,
              background: isSimulating ? 'rgba(255, 61, 87, 0.2)' : 'rgba(0, 212, 255, 0.15)',
              border: isSimulating ? '1px solid #ff3d57' : '1px solid var(--brand-primary)',
              color: isSimulating ? '#ff3d57' : 'var(--brand-primary)',
              fontSize: 10.5,
              fontWeight: 800,
              cursor: 'pointer',
            }}
            title="Simulate drone flight progression to MMR Base"
          >
            {isSimulating ? <Pause size={12} /> : <Play size={12} />}
            <span>{isSimulating ? 'PAUSE SIMULATION' : 'SIMULATE RTB FLIGHT'}</span>
          </button>
        </div>
      </div>

      {/* ── CESIUM 3D CANVAS VIEWPORT CONTAINER ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* ── FLOATING TELEMETRY HUD OVERLAY ── */}
        <div style={{
          position: 'absolute',
          top: 16,
          left: 16,
          width: 320,
          background: 'rgba(8, 16, 33, 0.92)',
          border: '1px solid rgba(0, 212, 255, 0.35)',
          borderRadius: 12,
          padding: 16,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          zIndex: 100,
          pointerEvents: 'all',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--brand-primary)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                LIVE 3D TELEMETRY STREAM
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
                {drone?.id || 'BOM-001'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {drone?.model || 'Phantom-Mumbai X7'} • Capacity: {drone?.max_payload_kg || 4.0} kg
              </div>
            </div>
            <span style={{
              fontSize: 9.5,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 10,
              background: drone?.status === 'RTB' ? 'rgba(255, 61, 87, 0.2)' : 'rgba(0, 212, 255, 0.2)',
              border: drone?.status === 'RTB' ? '1px solid #ff3d57' : '1px solid var(--brand-primary)',
              color: drone?.status === 'RTB' ? '#ff3d57' : 'var(--brand-primary)',
            }}>
              {drone?.status || 'RTB'}
            </span>
          </div>

          {/* Primary Telemetry Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            marginBottom: 12,
          }}>
            <div style={{ background: 'rgba(5, 12, 24, 0.8)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>ALTITUDE</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                {currentAlt.toFixed(1)} m
              </div>
            </div>

            <div style={{ background: 'rgba(5, 12, 24, 0.8)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>GROUND SPEED</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
                {currentSpeed} km/h
              </div>
            </div>
          </div>

          {/* GPS Coordinates */}
          <div style={{
            background: 'rgba(5, 12, 24, 0.8)',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>CURRENT GEOGRAPHIC GPS</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand-accent)', fontFamily: 'JetBrains Mono, monospace' }}>
              {currentLat.toFixed(6)}°N, {currentLng.toFixed(6)}°E
            </div>
          </div>

          {/* Battery Bar with Warning */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Battery size={11} /> BATTERY LEVEL
              </span>
              <span style={{
                color: currentBattery < 20 ? '#ff3d57' : currentBattery < 50 ? '#fbbf24' : '#06ffa5',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 800,
              }}>
                {currentBattery.toFixed(1)}% {currentBattery < 10 && '⚠️ CRITICAL'}
              </span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${currentBattery}%`,
                background: currentBattery < 20 ? '#ff3d57' : currentBattery < 50 ? '#fbbf24' : '#06ffa5',
                transition: 'width 200ms ease',
              }} />
            </div>
          </div>

          {/* Route to Base Mission Banner */}
          <div style={{
            background: 'rgba(0, 212, 255, 0.08)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: 8,
            padding: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800, color: 'var(--brand-primary)', marginBottom: 4 }}>
              <MapPin size={12} />
              <span>RETURN BASE CORRIDOR</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
              ➔ {MMR_BASE.name}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
              <span>Dist: {distToBaseKm.toFixed(2)} km</span>
              <span>ETA: {etaMinutes.toFixed(1)} min</span>
            </div>
          </div>

          {/* Notice on Data Source */}
          <div style={{ marginTop: 10, fontSize: 8.5, color: 'rgba(160,200,240,0.6)', textAlign: 'center' }}>
            {isSimulating ? '⚡ Virtual simulation flight active' : '📡 Real-time GPS stream synchronized'}
          </div>
        </div>

        {/* ── FLOATING CAMERA & MAP CONTROLS (Right Side) ── */}
        <div style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 100,
        }}>
          {[
            { id: 'zoom-in', icon: <Plus size={16} />, title: 'Zoom In', onClick: () => handleZoom(1) },
            { id: 'zoom-out', icon: <Minus size={16} />, title: 'Zoom Out', onClick: () => handleZoom(-1) },
            { id: 'tilt', icon: <Compass size={16} />, title: 'Toggle Tilt / Pitch (2D / 3D)', onClick: handleTilt },
            { id: 'reset', icon: <RotateCw size={15} />, title: 'Reset View on Drone', onClick: handleResetCamera },
          ].map(btn => (
            <button
              key={btn.id}
              onClick={btn.onClick}
              title={btn.title}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(8, 16, 33, 0.9)',
                border: '1px solid rgba(0, 212, 255, 0.35)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.2)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(8, 16, 33, 0.9)';
                e.currentTarget.style.color = 'var(--brand-primary)';
              }}
            >
              {btn.icon}
            </button>
          ))}

          <button
            onClick={() => setFollowDrone(!followDrone)}
            title={followDrone ? 'Camera Locked to Drone' : 'Free Camera'}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: followDrone ? 'rgba(6, 255, 165, 0.25)' : 'rgba(8, 16, 33, 0.9)',
              border: followDrone ? '1px solid #06ffa5' : '1px solid rgba(255, 255, 255, 0.15)',
              color: followDrone ? '#06ffa5' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            <Navigation size={15} />
          </button>
        </div>

        {/* ── BOTTOM BANNER (When API Key is Missing / Informational) ── */}
        {tilesetStatus !== 'active' && (
          <div style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(8, 16, 33, 0.95)',
            border: tilesetStatus === 'missing-key' ? '1px solid rgba(251, 191, 36, 0.5)' : '1px solid rgba(255, 61, 87, 0.5)',
            borderRadius: 10,
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            maxWidth: '90%',
            boxShadow: '0 8px 30px rgba(0,0,0,0.8)',
            backdropFilter: 'blur(16px)',
            zIndex: 150,
          }}>
            <AlertTriangle size={18} color={tilesetStatus === 'missing-key' ? '#fbbf24' : '#ff3d57'} />
            <div style={{ fontSize: 11.5, color: '#e2e8f0', lineHeight: 1.4 }}>
              <span style={{ fontWeight: 800, color: tilesetStatus === 'missing-key' ? '#fbbf24' : '#ff3d57' }}>
                {tilesetStatus === 'missing-key'
                  ? 'Google Photorealistic 3D Tiles Key Needed: '
                  : '3D Tiles Authentication Failed: '}
              </span>
              {tilesetStatus === 'missing-key'
                ? 'Configure VITE_GOOGLE_MAPS_API_KEY in frontend/.env to render Google Earth-grade 3D Buildings & Terrain. Running in high-altitude 3D vector mode.'
                : errorMessage || 'Verify your Google Cloud Map Tiles API key is valid.'}
            </div>
            <button
              onClick={() => setShowKeyModal(true)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                background: 'rgba(0, 212, 255, 0.2)',
                border: '1px solid var(--brand-primary)',
                color: 'var(--brand-primary)',
                fontWeight: 800,
                fontSize: 10.5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Enter API Key
            </button>
          </div>
        )}
      </div>

      {/* ── MODAL: Configure Google Maps Platform 3D Tiles API Key ── */}
      {showKeyModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 10, 23, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000,
          padding: 20,
        }}>
          <div style={{
            width: '100%',
            maxWidth: 520,
            background: 'rgba(8, 16, 33, 0.98)',
            border: '1px solid rgba(0, 212, 255, 0.4)',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 12px 40px rgba(0,0,0,0.9)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Key size={20} color="var(--brand-primary)" />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#fff' }}>
                Google Photorealistic 3D Tiles Configuration
              </h2>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
              CesiumJS uses Google Maps Platform's <strong>Map Tiles API</strong> to stream real-world photorealistic 3D city buildings, bridges, and terrain for Mumbai.
            </p>

            <form onSubmit={handleApplyKey}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                  Google Maps API Key (or Environment Variable)
                </label>
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="AIzaSy..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 6,
                    background: 'rgba(5, 12, 24, 0.9)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    color: '#fff',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{
                background: 'rgba(0, 212, 255, 0.06)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 11,
                color: 'var(--text-secondary)',
                marginBottom: 20,
              }}>
                <div style={{ fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 4 }}>
                  Permanent Setup:
                </div>
                Add this variable to <code style={{ color: '#fff' }}>c:\AeroRoute\frontend\.env</code>:
                <pre style={{
                  margin: '6px 0 0',
                  padding: '6px',
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: 4,
                  fontSize: 10.5,
                  color: '#06ffa5',
                  overflowX: 'auto',
                }}>
                  VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
                </pre>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'var(--text-muted)',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    background: 'var(--brand-primary)',
                    border: 'none',
                    color: '#030a17',
                    fontSize: 11.5,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  Apply & Load 3D Tiles
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
