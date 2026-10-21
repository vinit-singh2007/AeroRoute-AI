// AeroRoute AI — Google Maps Photorealistic 3D View
// Powered by Google Maps Platform 3D Tiles + CesiumJS
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as Cesium from 'cesium';
import {
  ArrowLeft,
  Navigation,
  Compass,
  Battery,
  Shield,
  Key,
  Play,
  Pause,
  RotateCw,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Eye,
  Radio,
  MapPin,
  ExternalLink,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';

const MMR_BASE = {
  id: 'hub-mmr',
  name: 'MMR Central Logistics Base',
  lat: 19.1940,
  lng: 72.8550,
  alt: 15,
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function Google3DView({
  drone,
  allDrones = [],
  hub = MMR_BASE,
  routeResult = null,
  onClose,
  onSelectDrone,
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const droneEntityRef = useRef(null);
  const dropLineEntityRef = useRef(null);
  const otherDroneEntitiesRef = useRef(new Map());
  const missionEntitiesRef = useRef([]);
  const orbitHeadingRef = useRef(0);
  const tickListenerRef = useRef(null);

  // ── API Key Management (LocalStorage -> Vite Env -> Prompt) ──
  const initialKey =
    localStorage.getItem('AEROROUTE_GOOGLE_MAPS_KEY') ||
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    '';

  const [apiKey, setApiKey] = useState(initialKey);
  const [inputKey, setInputKey] = useState(initialKey);
  const [tilesetStatus, setTilesetStatus] = useState('loading'); // 'loading' | 'active' | 'missing-key' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Camera Modes: 'aerial' | 'follow' | 'fpv' | 'orbit' ──
  const [cameraMode, setCameraMode] = useState('aerial');

  // ── Simulation Flight Mode ──
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);

  // Current active drone (fallback to first drone in fleet or default BOM-001)
  const activeDrone = useMemo(() => {
    if (drone) return drone;
    if (allDrones && allDrones.length > 0) return allDrones[0];
    return {
      id: 'BOM-001',
      model: 'Phantom-Mumbai X7',
      status: 'RTB',
      lat: 19.223,
      lng: 72.848,
      altitude_m: 86,
      speed_kmh: 62,
      battery_pct: 18,
      max_payload_kg: 4.0,
      heading_deg: 185,
    };
  }, [drone, allDrones]);

  // Interpolated Coordinates during Simulation or Live Stream
  const currentLat = useMemo(() => {
    if (!activeDrone) return 19.223;
    if (isSimulating) {
      if (routeResult?.waypoints?.length > 1) {
        const wps = routeResult.waypoints;
        const totalSegments = wps.length - 1;
        const scaledProgress = simProgress * totalSegments;
        const idx = Math.min(Math.floor(scaledProgress), totalSegments - 1);
        const segmentProgress = scaledProgress - idx;
        const p1 = wps[idx];
        const p2 = wps[idx + 1];
        return p1.lat + (p2.lat - p1.lat) * segmentProgress;
      }
      return activeDrone.lat + (hub.lat - activeDrone.lat) * simProgress;
    }
    return activeDrone.lat || 19.223;
  }, [activeDrone, isSimulating, simProgress, routeResult, hub.lat]);

  const currentLng = useMemo(() => {
    if (!activeDrone) return 72.848;
    if (isSimulating) {
      if (routeResult?.waypoints?.length > 1) {
        const wps = routeResult.waypoints;
        const totalSegments = wps.length - 1;
        const scaledProgress = simProgress * totalSegments;
        const idx = Math.min(Math.floor(scaledProgress), totalSegments - 1);
        const segmentProgress = scaledProgress - idx;
        const p1 = wps[idx];
        const p2 = wps[idx + 1];
        return p1.lng + (p2.lng - p1.lng) * segmentProgress;
      }
      return activeDrone.lng + (hub.lng - activeDrone.lng) * simProgress;
    }
    return activeDrone.lng || 72.848;
  }, [activeDrone, isSimulating, simProgress, routeResult, hub.lng]);

  const currentAlt = useMemo(() => {
    if (!activeDrone) return 86;
    if (isSimulating) {
      return Math.max(25, (activeDrone.altitude_m || 86) * (1 - simProgress * 0.65));
    }
    return activeDrone.altitude_m || activeDrone.altitude || 86;
  }, [activeDrone, isSimulating, simProgress]);

  const currentSpeed = useMemo(() => {
    if (!activeDrone) return 62;
    if (isSimulating) return simProgress > 0.96 ? 10 : 58;
    return activeDrone.speed_kmh || (activeDrone.speed_ms ? Math.round(activeDrone.speed_ms * 3.6) : 62);
  }, [activeDrone, isSimulating, simProgress]);

  const currentBattery = useMemo(() => {
    if (!activeDrone) return 18;
    if (isSimulating) {
      return Math.max(1, (activeDrone.battery_pct || 18) * (1 - simProgress * 0.35));
    }
    return activeDrone.battery_pct !== undefined ? activeDrone.battery_pct : 18;
  }, [activeDrone, isSimulating, simProgress]);

  const targetDest = useMemo(() => {
    if (routeResult?.destination) {
      return {
        name: routeResult.destination.name || 'Mission Target',
        lat: routeResult.destination.lat,
        lng: routeResult.destination.lng,
      };
    }
    return {
      name: hub?.name || 'MMR Central Base',
      lat: hub?.lat || MMR_BASE.lat,
      lng: hub?.lng || MMR_BASE.lng,
    };
  }, [routeResult, hub]);

  const distToTargetKm = useMemo(() => {
    return haversineKm(currentLat, currentLng, targetDest.lat, targetDest.lng);
  }, [currentLat, currentLng, targetDest]);

  const etaMinutes = useMemo(() => {
    if (currentSpeed <= 0) return 0;
    return (distToTargetKm / currentSpeed) * 60;
  }, [distToTargetKm, currentSpeed]);

  // ─────────────────────────────────────────────────────────────
  // 1. INITIALIZE CESIUM VIEWER & GOOGLE 3D TILES
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    if (typeof window !== 'undefined') {
      window.CESIUM_BASE_URL = window.CESIUM_BASE_URL || 'https://cdn.jsdelivr.net/npm/cesium@1.146.0/Build/Cesium/';
    }

    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken;
    }

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

    // Atmospheric & Tactical Lighting
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.highDynamicRange = true;

    if (viewer.bottomContainer) {
      viewer.bottomContainer.style.fontSize = '10px';
      viewer.bottomContainer.style.opacity = '0.7';
    }

    // ─────────────────────────────────────────────────────────
    // Load Google Photorealistic 3D Tiles
    // ─────────────────────────────────────────────────────────
    let tilesetPrimitive = null;

    async function loadGoogleTiles() {
      setTilesetStatus('loading');
      setErrorMessage('');

      if (!apiKey || !apiKey.trim()) {
        setTilesetStatus('missing-key');
        return;
      }

      try {
        tilesetPrimitive = await Cesium.createGooglePhotorealistic3DTileset({
          key: apiKey.trim(),
        });
        viewer.scene.primitives.add(tilesetPrimitive);
        setTilesetStatus('active');
      } catch (err) {
        console.error('Google Photorealistic 3D Tiles Error:', err);
        setTilesetStatus('error');
        setErrorMessage(err.message || 'Failed to authenticate Google Maps 3D Tiles');
      }
    }

    loadGoogleTiles();

    // ─────────────────────────────────────────────────────────
    // Hub Entity (Central Return Base)
    // ─────────────────────────────────────────────────────────
    const hubPos = Cesium.Cartesian3.fromDegrees(hub.lng || MMR_BASE.lng, hub.lat || MMR_BASE.lat, 15);
    viewer.entities.add({
      id: 'hub-marker-3d',
      name: hub.name || MMR_BASE.name,
      position: hubPos,
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#06ffa5'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `🏢 ${hub.name || MMR_BASE.name}\nLogistics Hub`,
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
    // Active Drone Entity & Drop-line
    // ─────────────────────────────────────────────────────────
    const initDronePos = Cesium.Cartesian3.fromDegrees(currentLng, currentLat, currentAlt);

    dropLineEntityRef.current = viewer.entities.add({
      id: 'active-drone-dropline',
      polyline: {
        positions: [
          Cesium.Cartesian3.fromDegrees(currentLng, currentLat, 0),
          initDronePos,
        ],
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('rgba(0, 212, 255, 0.8)'),
          dashLength: 10,
        }),
      },
    });

    droneEntityRef.current = viewer.entities.add({
      id: 'active-drone-3d',
      name: activeDrone.id,
      position: initDronePos,
      point: {
        pixelSize: 20,
        color: Cesium.Color.fromCssColorString(
          activeDrone.status === 'RTB' || activeDrone.status === 'PARACHUTE_DEPLOYED'
            ? '#ff3d57'
            : '#00d4ff'
        ),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `🚁 ${activeDrone.id} [${activeDrone.status || 'IN_FLIGHT'}]\nAlt: ${currentAlt.toFixed(0)}m • Spd: ${currentSpeed}km/h`,
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

    // Initial Tilted Aerial Camera
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(currentLng, currentLat - 0.005, currentAlt + 350),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-38),
        roll: 0.0,
      },
      duration: 1.8,
    });

    return () => {
      if (tilesetPrimitive && viewer.scene.primitives.contains(tilesetPrimitive)) {
        viewer.scene.primitives.remove(tilesetPrimitive);
      }
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, [apiKey]);

  // ─────────────────────────────────────────────────────────────
  // 2. DRAW MISSION ROUTE & WAYPOINTS IN 3D
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Clear previous mission route entities
    missionEntitiesRef.current.forEach((e) => {
      try {
        viewer.entities.remove(e);
      } catch { }
    });
    missionEntitiesRef.current = [];

    if (routeResult?.waypoints?.length > 1) {
      const wps = routeResult.waypoints;
      const cruiseAltitude = currentAlt || 90;

      const positions = wps.map((wp) =>
        Cesium.Cartesian3.fromDegrees(wp.lng, wp.lat, cruiseAltitude)
      );

      // 3D Elevated GA Flight Corridor
      const routePolyline = viewer.entities.add({
        id: 'mission-flight-corridor-3d',
        name: 'GA Optimised 3D Air Corridor',
        polyline: {
          positions,
          width: 5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.35,
            color: Cesium.Color.fromCssColorString('#00d4ff'),
          }),
        },
      });
      missionEntitiesRef.current.push(routePolyline);

      // Safe Landing Descent Path (Last 2 Waypoints down to surface)
      const lastWp = wps[wps.length - 1];
      const secondLastWp = wps[wps.length - 2];
      const landingPositions = [
        Cesium.Cartesian3.fromDegrees(secondLastWp.lng, secondLastWp.lat, cruiseAltitude),
        Cesium.Cartesian3.fromDegrees(lastWp.lng, lastWp.lat, 10),
      ];

      const landingApproach = viewer.entities.add({
        id: 'mission-landing-approach-3d',
        name: 'Landing Approach Corridor',
        polyline: {
          positions: landingPositions,
          width: 6,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.45,
            color: Cesium.Color.fromCssColorString('#06ffa5'),
          }),
        },
      });
      missionEntitiesRef.current.push(landingApproach);

      // Destination 3D Pin
      const destPin = viewer.entities.add({
        id: 'mission-destination-pin-3d',
        name: routeResult.destination?.name || 'Delivery Target',
        position: Cesium.Cartesian3.fromDegrees(lastWp.lng, lastWp.lat, 10),
        point: {
          pixelSize: 16,
          color: Cesium.Color.fromCssColorString('#06ffa5'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `🎯 DESTINATION\n${routeResult.destination?.name || 'Delivery Dropzone'}`,
          font: '11px "JetBrains Mono", monospace',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.fromCssColorString('#06ffa5'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      missionEntitiesRef.current.push(destPin);

      // Intermediate Waypoint Indicators
      wps.slice(1, -1).forEach((wp, idx) => {
        const wpPos = Cesium.Cartesian3.fromDegrees(wp.lng, wp.lat, cruiseAltitude);
        const wpEntity = viewer.entities.add({
          id: `waypoint-3d-${idx}`,
          position: wpPos,
          point: {
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString('#00d4ff'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: `WP-${idx + 1}`,
            font: '9px "JetBrains Mono", monospace',
            fillColor: Cesium.Color.fromCssColorString('#7ba3cc'),
            pixelOffset: new Cesium.Cartesian2(0, -12),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        missionEntitiesRef.current.push(wpEntity);
      });
    } else {
      // Fallback Default Corridor to Hub
      const fallbackPositions = [
        Cesium.Cartesian3.fromDegrees(currentLng, currentLat, currentAlt),
        Cesium.Cartesian3.fromDegrees(hub.lng || MMR_BASE.lng, hub.lat || MMR_BASE.lat, 15),
      ];

      const defaultCorridor = viewer.entities.add({
        id: 'default-hub-corridor-3d',
        name: 'Hub Return Corridor',
        polyline: {
          positions: fallbackPositions,
          width: 4,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.fromCssColorString(
              activeDrone.status === 'RTB' ? '#ff3d57' : '#00d4ff'
            ),
          }),
        },
      });
      missionEntitiesRef.current.push(defaultCorridor);
    }
  }, [routeResult, currentAlt, hub, activeDrone.status]);

  // ─────────────────────────────────────────────────────────────
  // 3. SYNCHRONIZE ACTIVE DRONE POSITION & CAMERA MODES
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const newPos = Cesium.Cartesian3.fromDegrees(currentLng, currentLat, currentAlt);

    if (droneEntityRef.current) {
      droneEntityRef.current.position = newPos;
      if (droneEntityRef.current.label) {
        droneEntityRef.current.label.text = `🚁 ${activeDrone.id} [${activeDrone.status || 'IN_FLIGHT'}]\nAlt: ${currentAlt.toFixed(0)}m • Spd: ${currentSpeed}km/h`;
      }
      if (droneEntityRef.current.point) {
        droneEntityRef.current.point.color = Cesium.Color.fromCssColorString(
          activeDrone.status === 'RTB' || activeDrone.status === 'PARACHUTE_DEPLOYED'
            ? '#ff3d57'
            : '#00d4ff'
        );
      }
    }

    if (dropLineEntityRef.current?.polyline) {
      dropLineEntityRef.current.polyline.positions = [
        Cesium.Cartesian3.fromDegrees(currentLng, currentLat, 0),
        newPos,
      ];
    }

    // Camera Mode Execution
    if (cameraMode === 'follow') {
      viewer.camera.lookAt(
        newPos,
        new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(activeDrone.heading_deg || 0),
          Cesium.Math.toRadians(-28),
          260
        )
      );
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    } else if (cameraMode === 'fpv') {
      viewer.camera.lookAt(
        newPos,
        new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(activeDrone.heading_deg || 0),
          Cesium.Math.toRadians(-6),
          45
        )
      );
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }
  }, [currentLat, currentLng, currentAlt, currentSpeed, activeDrone, cameraMode]);

  // ─────────────────────────────────────────────────────────────
  // 4. ORBIT CAMERA ANIMATION LOOP
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    if (cameraMode === 'orbit') {
      const onTick = () => {
        orbitHeadingRef.current = (orbitHeadingRef.current + 0.35) % 360;
        const targetPos = Cesium.Cartesian3.fromDegrees(currentLng, currentLat, currentAlt);
        viewer.camera.lookAt(
          targetPos,
          new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(orbitHeadingRef.current),
            Cesium.Math.toRadians(-32),
            320
          )
        );
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      };

      viewer.clock.onTick.addEventListener(onTick);
      tickListenerRef.current = onTick;

      return () => {
        if (tickListenerRef.current) {
          viewer.clock.onTick.removeEventListener(tickListenerRef.current);
          tickListenerRef.current = null;
        }
      };
    }
  }, [cameraMode, currentLat, currentLng, currentAlt]);

  // ─────────────────────────────────────────────────────────────
  // 5. SIMULATION FLIGHT LOOP
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setSimProgress((prev) => {
        if (prev >= 1) {
          setIsSimulating(false);
          return 1;
        }
        return Math.min(1, prev + 0.007);
      });
    }, 140);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // ─────────────────────────────────────────────────────────────
  // 6. CAMERA CONTROL HELPERS
  // ─────────────────────────────────────────────────────────────
  const handleZoom = (amount) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (amount > 0) viewer.camera.zoomIn(140);
    else viewer.camera.zoomOut(140);
  };

  const handleResetCamera = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    setCameraMode('aerial');
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(currentLng, currentLat - 0.005, currentAlt + 350),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-38),
        roll: 0.0,
      },
      duration: 1.4,
    });
  };

  const handleTiltToggle = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const currentPitch = Cesium.Math.toDegrees(viewer.camera.pitch);
    const newPitch = currentPitch < -60 ? -32 : -88;
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

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleApplyKey = (e) => {
    e.preventDefault();
    const cleanKey = inputKey.trim();
    if (!cleanKey) return;
    localStorage.setItem('AEROROUTE_GOOGLE_MAPS_KEY', cleanKey);
    setApiKey(cleanKey);
    setShowKeyModal(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: '#020610',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* ── TOP CONTROL BAR ── */}
      <div
        style={{
          height: 56,
          padding: '0 18px',
          background: 'rgba(4, 9, 20, 0.96)',
          borderBottom: '1px solid rgba(0, 212, 255, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backdropFilter: 'blur(16px)',
          zIndex: 10,
          boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
        }}
      >
        {/* Left: Exit to 2D Map & Active Drone Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={onClose}
            id="btn-exit-3d-view"
            title="Return to 2D Fleet Overview Map"
            style={{
              background: 'rgba(0, 212, 255, 0.12)',
              border: '1px solid rgba(0, 212, 255, 0.5)',
              borderRadius: 6,
              padding: '6px 14px',
              color: 'var(--brand-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: '0.5px',
              transition: 'all 120ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 212, 255, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 212, 255, 0.12)')}
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: '#fff',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {activeDrone.id}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              • {activeDrone.model || 'Phantom-Mumbai X7'}
            </span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 12,
                background:
                  activeDrone.status === 'RTB'
                    ? 'rgba(255, 61, 87, 0.2)'
                    : 'rgba(6, 255, 165, 0.2)',
                border:
                  activeDrone.status === 'RTB'
                    ? '1px solid #ff3d57'
                    : '1px solid #06ffa5',
                color: activeDrone.status === 'RTB' ? '#ff3d57' : '#06ffa5',
              }}
            >
              {activeDrone.status || 'IN_FLIGHT'}
            </span>
          </div>
        </div>

        {/* Center: Camera Mode Selector Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: 'rgba(8, 16, 33, 0.9)',
            padding: '3px 6px',
            borderRadius: 20,
            border: '1px solid var(--border-subtle)',
          }}
        >
          {[
            { id: 'aerial', label: 'Tilted Aerial', icon: '🏙️' },
            { id: 'follow', label: 'Follow Drone', icon: '🚁' },
            { id: 'fpv', label: 'FPV Nose Cam', icon: '🎯' },
            { id: 'orbit', label: '360° Orbit', icon: '🔄' },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setCameraMode(mode.id)}
              style={{
                background:
                  cameraMode === mode.id ? 'rgba(0, 212, 255, 0.22)' : 'transparent',
                border:
                  cameraMode === mode.id
                    ? '1px solid rgba(0, 212, 255, 0.55)'
                    : '1px solid transparent',
                color: cameraMode === mode.id ? 'var(--brand-primary)' : 'var(--text-secondary)',
                borderRadius: 14,
                padding: '3px 10px',
                fontSize: 10.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 120ms ease',
                outline: 'none',
              }}
            >
              <span>{mode.icon}</span>
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        {/* Right: Google Photorealistic 3D Status & Simulation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            onClick={() => setShowKeyModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 6,
              background:
                tilesetStatus === 'active'
                  ? 'rgba(6, 255, 165, 0.12)'
                  : tilesetStatus === 'missing-key'
                    ? 'rgba(251, 191, 36, 0.15)'
                    : 'rgba(255, 61, 87, 0.15)',
              border:
                tilesetStatus === 'active'
                  ? '1px solid rgba(6, 255, 165, 0.4)'
                  : tilesetStatus === 'missing-key'
                    ? '1px solid rgba(251, 191, 36, 0.4)'
                    : '1px solid rgba(255, 61, 87, 0.4)',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 800,
              color:
                tilesetStatus === 'active'
                  ? '#06ffa5'
                  : tilesetStatus === 'missing-key'
                    ? '#fbbf24'
                    : '#ff3d57',
            }}
            title="Click to configure Google Maps Platform 3D Tiles API Key"
          >
            <Key size={12} />
            <span>
              {tilesetStatus === 'active'
                ? 'GOOGLE 3D TILES ACTIVE'
                : tilesetStatus === 'missing-key'
                  ? '3D TILES: API KEY NEEDED'
                  : '3D TILES: AUTH ERROR'}
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
            title="Simulate drone flight progression along the corridor"
          >
            {isSimulating ? <Pause size={12} /> : <Play size={12} />}
            <span>{isSimulating ? 'PAUSE SIMULATION' : 'SIMULATE FLIGHT'}</span>
          </button>
        </div>
      </div>

      {/* ── MAIN 3D CESIUM VIEWPORT ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* ── FLOATING HUD: Live Telemetry & Mission Progress (Left Side) ── */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            width: 310,
            background: 'rgba(5, 12, 26, 0.92)',
            border: '1px solid rgba(0, 212, 255, 0.35)',
            borderRadius: 12,
            padding: 16,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            zIndex: 100,
            pointerEvents: 'all',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: 'var(--brand-primary)',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                }}
              >
                GOOGLE 3D MISSION TELEMETRY
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: '#fff',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {activeDrone.id}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                {activeDrone.model || 'Phantom-Mumbai X7'}
              </div>
            </div>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 10,
                background:
                  activeDrone.status === 'RTB'
                    ? 'rgba(255, 61, 87, 0.2)'
                    : 'rgba(0, 212, 255, 0.2)',
                border:
                  activeDrone.status === 'RTB'
                    ? '1px solid #ff3d57'
                    : '1px solid var(--brand-primary)',
                color: activeDrone.status === 'RTB' ? '#ff3d57' : 'var(--brand-primary)',
              }}
            >
              {activeDrone.status || 'ACTIVE'}
            </span>
          </div>

          {/* Telemetry Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                background: 'rgba(3, 8, 18, 0.8)',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>ALTITUDE (AGL)</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--brand-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {currentAlt.toFixed(1)} m
              </div>
            </div>

            <div
              style={{
                background: 'rgba(3, 8, 18, 0.8)',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>GROUND SPEED</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#fff',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {currentSpeed} km/h
              </div>
            </div>
          </div>

          {/* GPS Coordinates */}
          <div
            style={{
              background: 'rgba(3, 8, 18, 0.8)',
              padding: '7px 10px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 8.5, color: 'var(--text-muted)', marginBottom: 2 }}>
              GPS COORDINATES
            </div>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: 'var(--brand-accent)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {currentLat.toFixed(5)}°N, {currentLng.toFixed(5)}°E
            </div>
          </div>

          {/* Battery Level */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 9.5,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Battery size={11} /> BATTERY
              </span>
              <span
                style={{
                  color:
                    currentBattery < 20
                      ? '#ff3d57'
                      : currentBattery < 50
                        ? '#fbbf24'
                        : '#06ffa5',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 800,
                }}
              >
                {currentBattery.toFixed(1)}% {currentBattery < 15 && '⚠️ LOW'}
              </span>
            </div>
            <div
              style={{
                height: 5,
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${currentBattery}%`,
                  background:
                    currentBattery < 20
                      ? '#ff3d57'
                      : currentBattery < 50
                        ? '#fbbf24'
                        : '#06ffa5',
                  transition: 'width 200ms ease',
                }}
              />
            </div>
          </div>

          {/* Mission Target Corridor */}
          <div
            style={{
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: 8,
              padding: '9px 10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--brand-primary)',
                marginBottom: 3,
              }}
            >
              <MapPin size={11} />
              <span>FLIGHT CORRIDOR</span>
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              ➔ {targetDest.name}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 9,
                color: 'var(--text-muted)',
                marginTop: 4,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              <span>Dist: {distToTargetKm.toFixed(2)} km</span>
              <span>ETA: {etaMinutes.toFixed(1)} min</span>
            </div>
          </div>

          {/* Simulation vs Live Stream Indicator */}
          <div
            style={{
              marginTop: 9,
              fontSize: 8.5,
              color: isSimulating ? '#fbbf24' : 'rgba(160,200,240,0.65)',
              textAlign: 'center',
            }}
          >
            {isSimulating
              ? '⚡ Virtual Simulation Flight Active'
              : '📡 Real-time Telemetry Connected'}
          </div>
        </div>

        {/* ── FLOATING CAMERA & ACTION CONTROLS (Right Side) ── */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 100,
          }}
        >
          {[
            { id: 'zoom-in', icon: <Plus size={16} />, title: 'Zoom In', onClick: () => handleZoom(1) },
            { id: 'zoom-out', icon: <Minus size={16} />, title: 'Zoom Out', onClick: () => handleZoom(-1) },
            { id: 'tilt', icon: <Compass size={16} />, title: 'Toggle Tilt / Pitch (2D / 3D Angle)', onClick: handleTiltToggle },
            { id: 'reset', icon: <RotateCw size={15} />, title: 'Reset Aerial Camera View', onClick: handleResetCamera },
            { id: 'fs', icon: isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />, title: 'Toggle Fullscreen', onClick: handleToggleFullscreen },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={btn.onClick}
              title={btn.title}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(5, 12, 26, 0.92)',
                border: '1px solid rgba(0, 212, 255, 0.35)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.22)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(5, 12, 26, 0.92)';
                e.currentTarget.style.color = 'var(--brand-primary)';
              }}
            >
              {btn.icon}
            </button>
          ))}
        </div>

        {/* ── BANNER WHEN API KEY IS MISSING ── */}
        {tilesetStatus !== 'active' && (
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(5, 12, 26, 0.96)',
              border:
                tilesetStatus === 'missing-key'
                  ? '1px solid rgba(251, 191, 36, 0.6)'
                  : '1px solid rgba(255, 61, 87, 0.6)',
              borderRadius: 10,
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              maxWidth: '92%',
              boxShadow: '0 8px 30px rgba(0,0,0,0.85)',
              backdropFilter: 'blur(16px)',
              zIndex: 150,
            }}
          >
            <AlertTriangle
              size={18}
              color={tilesetStatus === 'missing-key' ? '#fbbf24' : '#ff3d57'}
            />
            <div style={{ fontSize: 11.5, color: '#e2e8f0', lineHeight: 1.4 }}>
              <span
                style={{
                  fontWeight: 800,
                  color: tilesetStatus === 'missing-key' ? '#fbbf24' : '#ff3d57',
                }}
              >
                {tilesetStatus === 'missing-key'
                  ? 'Google Photorealistic 3D Tiles Key Needed: '
                  : '3D Tiles Authentication Failed: '}
              </span>
              {tilesetStatus === 'missing-key'
                ? 'Enable Google Maps Map Tiles API to render actual Mumbai buildings, rooftops, and 3D terrain.'
                : errorMessage || 'Verify that Map Tiles API is enabled in your Google Cloud Console.'}
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
              Configure Key
            </button>
          </div>
        )}
      </div>

      {/* ── MODAL: Configure Google Maps Platform 3D Tiles API Key ── */}
      {showKeyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 16, 0.88)',
            backdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 540,
              background: 'rgba(6, 14, 30, 0.98)',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 12px 40px rgba(0,0,0,0.9)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Key size={20} color="var(--brand-primary)" />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#fff' }}>
                Google Photorealistic 3D Tiles Configuration
              </h2>
            </div>

            <p
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              CesiumJS streams Google's real-world photorealistic 3D city buildings, roads, and terrain
              via Google Maps Platform's <strong>Map Tiles API</strong>.
            </p>

            <form onSubmit={handleApplyKey}>
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                  }}
                >
                  Enter Google Maps API Key
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
                    background: 'rgba(4, 9, 20, 0.95)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    color: '#fff',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Step by step Google Cloud guide */}
              <div
                style={{
                  background: 'rgba(0, 212, 255, 0.05)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.45,
                  marginBottom: 18,
                }}
              >
                <div style={{ fontWeight: 800, color: 'var(--brand-primary)', marginBottom: 4 }}>
                  Setup Steps in Google Cloud Console:
                </div>
                <ol style={{ margin: '0 0 6px 18px', padding: 0 }}>
                  <li>Go to Google Cloud Console and select/create a project.</li>
                  <li>Enable billing (Google provides $200 free monthly credit).</li>
                  <li>Enable <strong>Map Tiles API</strong> in APIs & Services.</li>
                  <li>Create Credentials → API Key (restrict to Map Tiles API).</li>
                </ol>
                <div>
                  Saved in your browser session and persists across page reloads.
                </div>
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
                    color: '#020610',
                    fontSize: 11.5,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  Save & Load 3D Tiles
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
