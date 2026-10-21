// AeroRoute — Interactive Fleet Map (Mumbai Logistics Network)
// Multi-Drone Dynamic Flight Tracking & Corridor Visualization
import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default icon path issue in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom SVG drone marker with real-time floating status badge
function droneIcon(drone, isSelected) {
  const status = drone.status;
  const isParachuted = status === 'PARACHUTE_DEPLOYED';

  // ── PARACHUTE DEPLOYED: black/dead marker, no glow, no animation ──
  if (isParachuted) {
    const shortId = drone.id.replace('BOM-00', 'BOM-').replace('BOM-0', 'BOM-');
    const deployLat = drone.lat?.toFixed(4) ?? '?';
    const deployLng = drone.lng?.toFixed(4) ?? '?';
    const html = `
      <div style="position:relative;width:200px;height:72px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;user-select:none;pointer-events:all;cursor:pointer;">
        <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="17" fill="rgba(10,10,12,0.97)" stroke="#444" stroke-width="2"/>
            <rect x="16" y="16" width="8" height="8" rx="2" fill="#333" opacity="0.9"/>
            <line x1="8" y1="10" x2="16" y2="17" stroke="#333" stroke-width="2"/>
            <line x1="32" y1="10" x2="24" y2="17" stroke="#333" stroke-width="2"/>
            <line x1="8"  y1="30" x2="16" y2="23" stroke="#333" stroke-width="2"/>
            <line x1="32" y1="30" x2="24" y2="23" stroke="#333" stroke-width="2"/>
            <circle cx="8"  cy="10" r="3.5" fill="#222" stroke="#444" stroke-width="1.6"/>
            <circle cx="32" cy="10" r="3.5" fill="#222" stroke="#444" stroke-width="1.6"/>
            <circle cx="8"  cy="30" r="3.5" fill="#222" stroke="#444" stroke-width="1.6"/>
            <circle cx="32" cy="30" r="3.5" fill="#222" stroke="#444" stroke-width="1.6"/>
            <text x="20" y="24" text-anchor="middle" font-size="11" fill="#666">✕</text>
          </svg>
        </div>
        <div style="
          margin-top: 3px;
          background: rgba(8, 4, 4, 0.97);
          border: 1.5px solid #5a1a1a;
          color: #888;
          padding: 3px 9px;
          border-radius: 12px;
          font-size: 9.5px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 800;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 5px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.9);
        ">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#333;"></span>
          <span style="color:#666">${shortId}</span>
          <span style="color:#5a1a1a">⛑️ PARACHUTE</span>
        </div>
      </div>`;
    return L.divIcon({
      html,
      className: 'custom-drone-leaflet-icon',
      iconSize: [200, 72],
      iconAnchor: [100, 20],
      popupAnchor: [0, 32],
    });
  }

  const batteryNum = Number(drone.battery_pct ?? 100);
  const windNum = Number(drone.wind_gust_ms ?? 0);
  const fsiNum = Number(drone.fsi ?? 100);
  const actionStatus = drone.action_status || 'SAFE';

  // ── Real-Time Hazard & Condition Assessment (Matches User Requirements & System Legend) ──
  // 1. DANGER & EMERGENCY RTB (RED ONLY):
  // Turns RED *only* if an Emergency RTB was initiated or actual hazard/danger occurred
  const isEmergencyRTB = status === 'RTB' || drone.emergency_rtb === true;
  const isDanger =
    batteryNum < 25 ||
    (typeof drone.fsi === 'number' && fsiNum < 40) ||
    windNum > 15 ||
    actionStatus === 'CRITICAL';

  const isEmergency = isEmergencyRTB || isDanger;

  // 2. NORMAL RETURNING (STAYS GREEN AS REQUESTED BY USER):
  // Completed delivery returning drones stay GREEN and display a clean "D" (Delivered) badge!
  const isNormalReturning = status === 'RETURNING' && !isEmergencyRTB;

  // 3. CAUTION STATE (YELLOW - only for active flight caution e.g. moderate wind without emergency):
  const isCaution =
    !isEmergency &&
    !isNormalReturning && (
      batteryNum < 50 ||
      (typeof drone.fsi === 'number' && fsiNum < 65) ||
      windNum > 10 ||
      actionStatus === 'WARNING' ||
      actionStatus === 'CAUTION' ||
      actionStatus === 'REROUTE_RECOMMENDED'
    );

  // Normal delivering AND normal returning are BOTH GREEN!
  const isGreen = (status === 'DELIVERING' || isNormalReturning) && !isEmergency && !isCaution;

  const color =
    isEmergency ? '#ff3d57' : // RED: Only for actual RTB / Danger
      isCaution ? '#fbbf24' : // YELLOW: Weather/Battery Caution during flight
        isGreen ? '#06ffa5' : '#00d4ff'; // GREEN: Delivering or Returning after delivery (Delivered)

  // Clean Drone ID format: e.g. BOM-001 or BOM-1 -> BOM-01
  const formatDroneId = (id) => {
    if (!id) return 'BOM-01';
    const match = id.match(/^(?:BOM-?)0*(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      return `BOM-${num < 10 ? '0' + num : num}`;
    }
    return id;
  };
  const cleanDroneId = formatDroneId(drone.id);

  // Badge BELOW drone body — ultra-clean, minimal: only drone ID + optional [D] delivered tag
  const html = `
    <div style="position:relative;width:120px;height:66px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;user-select:none;pointer-events:all;cursor:pointer;">
      <!-- Drone Body Graphic with High-Contrast Pulse -->
      <div style="position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <div style="position:absolute;inset:-3px;border-radius:50%;background:${color}22;box-shadow:0 0 14px ${color};"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="17" fill="rgba(5,12,24,0.95)" stroke="${color}" stroke-width="${isSelected ? '2.5' : '2'}"/>
          <rect x="16" y="16" width="8" height="8" rx="2" fill="${color}" opacity="0.95"/>
          <line x1="8" y1="10" x2="16" y2="17" stroke="${color}" stroke-width="2"/>
          <line x1="32" y1="10" x2="24" y2="17" stroke="${color}" stroke-width="2"/>
          <line x1="8"  y1="30" x2="16" y2="23" stroke="${color}" stroke-width="2"/>
          <line x1="32" y1="30" x2="24" y2="23" stroke="${color}" stroke-width="2"/>
          <circle cx="8"  cy="10" r="3.5" fill="${color}33" stroke="${color}" stroke-width="1.6"/>
          <circle cx="32" cy="10" r="3.5" fill="${color}33" stroke="${color}" stroke-width="1.6"/>
          <circle cx="8"  cy="30" r="3.5" fill="${color}33" stroke="${color}" stroke-width="1.6"/>
          <circle cx="32" cy="30" r="3.5" fill="${color}33" stroke="${color}" stroke-width="1.6"/>
        </svg>
      </div>

      <!-- Floating Label Badge BELOW drone body -->
      <div style="
        margin-top: 3px;
        background: rgba(4, 10, 22, 0.96);
        border: 1.5px solid ${isSelected ? '#00d4ff' : color};
        color: #fff;
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 10.5px;
        font-family: 'JetBrains Mono', monospace;
        font-weight: 800;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.8), 0 0 ${isSelected ? '12px #00d4ff' : '8px ' + color}99;
        backdrop-filter: blur(8px);
      ">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};"></span>
        <span style="color:${isEmergency ? '#ff3d57' : isCaution ? '#fbbf24' : '#00d4ff'};letter-spacing:0.4px;">${cleanDroneId}</span>
        ${isNormalReturning ? `<span style="background:rgba(6,255,165,0.22);color:#06ffa5;border:1px solid rgba(6,255,165,0.55);border-radius:4px;padding:0 5px;font-size:9px;font-weight:900;line-height:13px;box-shadow:0 0 6px rgba(6,255,165,0.3);" title="Delivered — Returning to Base">D</span>` : ''}
        ${isEmergencyRTB ? `<span style="background:rgba(255,61,87,0.22);color:#ff3d57;border:1px solid rgba(255,61,87,0.55);border-radius:4px;padding:0 4px;font-size:9px;font-weight:900;line-height:13px;">RTB</span>` : ''}
        ${isDanger && !isEmergencyRTB ? `<span style="color:#ff3d57;font-weight:900;font-size:10px;">⚠️</span>` : ''}
      </div>
    </div>`;

  return L.divIcon({
    html: html,
    className: 'custom-drone-leaflet-icon',
    iconSize: [120, 66],
    iconAnchor: [60, 19], // Anchor at center of drone SVG body (top part)
    popupAnchor: [0, 28], // Popup appears below badge
  });
}

function hubIcon() {
  const html = `
    <div style="
      background: rgba(5,12,24,0.96);
      border: 1.5px solid #00d4ff;
      color: #00d4ff;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 800;
      white-space: nowrap;
      box-shadow: 0 0 14px rgba(0,212,255,0.6), 0 2px 10px rgba(0,0,0,0.8);
      display: flex;
      align-items: center;
      gap: 5px;
      pointer-events: auto;
      cursor: pointer;
    ">
      <span>🏭</span>
      <span>MMR CENTRAL HUB</span>
    </div>`;
  return L.divIcon({
    html,
    className: 'custom-hub-leaflet-icon',
    iconSize: [150, 26],
    iconAnchor: [75, 13],
  });
}

function destinationTargetIcon(drone) {
  const shortId = drone.id.replace('BOM-00', 'BOM-').replace('BOM-0', 'BOM-');
  const orderText = drone.order_id && drone.order_id !== 'STANDBY' ? drone.order_id : 'MISSION';
  const svg = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
      <div style="
        position:absolute;
        bottom:34px;
        background:rgba(5,12,24,0.92);
        border:1px solid #06ffa5;
        color:#06ffa5;
        padding:2px 7px;
        border-radius:10px;
        font-size:9px;
        font-family:'JetBrains Mono',monospace;
        font-weight:800;
        white-space:nowrap;
        box-shadow:0 0 8px rgba(6,255,165,0.4);
      ">
        🎯 ${shortId} TARGET

      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
        <circle cx="17" cy="17" r="14" fill="rgba(6,255,165,0.18)" stroke="#06ffa5" stroke-width="2"/>
        <text x="17" y="22" text-anchor="middle" font-size="14">📦</text>
      </svg>
    </div>`;
  return L.divIcon({
    html: svg,
    className: 'custom-destination-leaflet-icon',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  });
}

function waypointIcon(type) {
  const isOrigin = type === 'origin';
  const isDest = type === 'destination';
  const color = isDest ? '#06ffa5' : isOrigin ? '#00d4ff' : '#7c3aed';
  const emoji = isDest ? '📦' : isOrigin ? '🚁' : '📍';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="13" fill="rgba(5,12,24,0.9)" stroke="${color}" stroke-width="2"/>
      <text x="15" y="20" text-anchor="middle" font-size="12">${emoji}</text>
    </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -18] });
}

export default function FleetMap({
  drones = [],
  hub,
  routeResult,
  selectedDroneId,
  onDroneSelect,
  onMapClick,
  customDestination,
  sidebarState,
  mapTheme = 'satellite',
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const tileLayerRef = useRef(null);
  const droneMarkers = useRef({});
  const missionCorridors = useRef({}); // { [droneId]: { line: Polyline, targetMarker: Marker } }
  const routeLayers = useRef([]);
  const hubMarker = useRef(null);
  const customDestMarker = useRef(null);
  const nfzLayers = useRef([]);
  const hasInitialFit = useRef(false);
  const prevDeliveringIds = useRef(new Set()); // Track active delivering drone IDs
  const dronesRef = useRef(drones); // Always-fresh ref to latest drones array
  const hubRef = useRef(hub);    // Always-fresh ref to hub

  // Keep refs in sync
  useEffect(() => { dronesRef.current = drones; }, [drones]);
  useEffect(() => { hubRef.current = hub; }, [hub]);

  // Auto-resize Leaflet map whenever container bounds change
  useEffect(() => {
    if (!mapRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstance.current && mapRef.current) {
        try {
          mapInstance.current.invalidateSize({ debounceMoveend: true });
        } catch { /* ignore if unmounting */ }
      }
    });
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);

  // Multi-frame invalidation to sync with CSS sidebar collapse transition
  useEffect(() => {
    if (!mapInstance.current) return;
    try {
      mapInstance.current.invalidateSize();
    } catch { }
    const t1 = setTimeout(() => {
      try { mapInstance.current?.invalidateSize(); } catch { }
    }, 50);
    const t2 = setTimeout(() => {
      try { mapInstance.current?.invalidateSize(); } catch { }
    }, 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [sidebarState]);

  // Fit all active drones and hub into a comfortable view
  // Uses refs so it always reads the LATEST drone data — never stale
  // Uses refs so it always reads the LATEST drone data — never stale
  const fitFleetBounds = useCallback(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    const latestDrones = dronesRef.current;
    const latestHub = hubRef.current;
    const points = [];

    if (latestHub?.lat && latestHub?.lng) {
      points.push([latestHub.lat, latestHub.lng]);
    }

    latestDrones.forEach(d => {
      const isFlying = d.status === 'DELIVERING' || d.status === 'RETURNING' || d.status === 'IN_FLIGHT' || d.status === 'RTB';
      if (isFlying) {
        if (typeof d.dest_lat === 'number' && typeof d.dest_lng === 'number') {
          points.push([d.dest_lat, d.dest_lng]);
        }
        if (typeof d.lat === 'number' && typeof d.lng === 'number') {
          points.push([d.lat, d.lng]);
        }
      }
    });

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 13, animate: true, duration: 0.8 });
    } else if (points.length === 1) {
      map.setView(points[0], 12);
    }
  }, []); // No deps — always reads from refs

  // Dynamic Tile Layer Swapping (Tactical Dark, High-Res Satellite, Clean Street)
  useEffect(() => {
    if (!mapInstance.current) return;
    if (tileLayerRef.current) {
      mapInstance.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    if (mapTheme === 'satellite') {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '&copy; Esri World Imagery &mdash; Source: Esri, Maxar, Earthstar Geographics',
          maxZoom: 18,
        }
      ).addTo(mapInstance.current);
    } else {
      tileLayerRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          subdomains: ['a', 'b', 'c'],
          maxZoom: 19,
        }
      ).addTo(mapInstance.current);
    }
  }, [mapTheme]);

  // Initialize Mumbai Map
  useEffect(() => {
    if (mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: [19.1800, 72.8650], // Framed across MMR
      zoom: 11,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial tile
    const initialTile = mapTheme === 'satellite'
      ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri World Imagery',
        maxZoom: 18,
      })
      : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        subdomains: ['a', 'b', 'c'],
        maxZoom: 19,
      });
    initialTile.addTo(map);
    tileLayerRef.current = initialTile;

    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    mapInstance.current = map;

    // Hub marker: created immediately with map
    const hubLat = hubRef.current?.lat ?? 19.1940;
    const hubLng = hubRef.current?.lng ?? 72.8550;
    hubMarker.current = L.marker([hubLat, hubLng], { icon: hubIcon(), zIndexOffset: 15000 })
      .addTo(map)
      .bindPopup('<b style="color:#00d4ff">AeroRoute Mumbai Hub</b><br><span style="color:#7ba3cc;font-size:11px">MMR Central Logistics Base</span>');

    // Mumbai No-Fly Zones
    const mumbaiNFZ = [
      { center: [19.0896, 72.8656], radius: 2200, name: 'CSMIA International Airport Exclusion Zone' },
      { center: [18.9150, 72.8300], radius: 1500, name: 'Colaba Naval Dockyard Military Restricted Area' },
      { center: [19.0060, 72.9150], radius: 1400, name: 'BARC Trombay Nuclear Security Zone' },
      { center: [18.9430, 72.7950], radius: 800, name: 'Malabar Hill VIP Security Corridor' },
    ];

    mumbaiNFZ.forEach(zone => {
      const circle = L.circle(zone.center, {
        radius: zone.radius,
        color: '#ff3d57',
        fillColor: '#ff3d57',
        fillOpacity: 0.14,
        weight: 2,
        dashArray: '6 4',
        opacity: 0.8,
      }).addTo(map);
      circle.bindPopup(`
        <div style="font-family:Inter,sans-serif;color:#e8f4ff;background:#0d1930;padding:6px;border-radius:6px">
          <b style="color:#ff3d57">🚫 ${zone.name}</b><br>
          <span style="color:#7ba3cc;font-size:11px">Geofenced No-Fly Radius: ${zone.radius}m</span>
        </div>`);
      nfzLayers.current.push(circle);
    });

    setTimeout(() => { map.invalidateSize(); }, 80);
    setTimeout(() => { map.invalidateSize(); }, 300);

    return () => {
      map.remove();
      mapInstance.current = null;
      hubMarker.current = null;
    };
  }, []);

  // Hub marker: keep coordinates and icon in sync
  useEffect(() => {
    if (!mapInstance.current) return;
    const lat = hub?.lat ?? 19.1940;
    const lng = hub?.lng ?? 72.8550;

    if (!hubMarker.current || !mapInstance.current.hasLayer(hubMarker.current)) {
      if (hubMarker.current) {
        try { mapInstance.current.removeLayer(hubMarker.current); } catch { }
      }
      hubMarker.current = L.marker([lat, lng], { icon: hubIcon(), zIndexOffset: 15000 })
        .addTo(mapInstance.current)
        .bindPopup('<b style="color:#00d4ff">AeroRoute Mumbai Hub</b><br><span style="color:#7ba3cc;font-size:11px">MMR Central Logistics Base</span>');
    } else {
      hubMarker.current.setLatLng([lat, lng]);
      hubMarker.current.setIcon(hubIcon());
    }
  }, [hub]);

  // Update custom destination marker if set by user click
  useEffect(() => {
    if (!mapInstance.current) return;
    if (customDestination) {
      if (customDestMarker.current) {
        customDestMarker.current.setLatLng([customDestination.lat, customDestination.lng]);
      } else {
        customDestMarker.current = L.marker([customDestination.lat, customDestination.lng], {
          icon: waypointIcon('destination'),
        })
          .addTo(mapInstance.current)
          .bindPopup('<b style="color:#06ffa5">Custom Target Point</b><br><span style="color:#7ba3cc;font-size:11px">Pinned via Map Click</span>');
      }
    } else if (customDestMarker.current) {
      mapInstance.current.removeLayer(customDestMarker.current);
      customDestMarker.current = null;
    }
  }, [customDestination]);

  // ── MULTI-DRONE REAL-TIME TRACKING & FLIGHT CORRIDORS ──
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    const flyingStatuses = new Set(['DELIVERING', 'RETURNING', 'IN_FLIGHT', 'RTB', 'PARACHUTE_DEPLOYED']);

    // Separate active flying drones from standby drones at hub
    const activeFlyingDrones = drones.filter(d =>
      flyingStatuses.has(d.status) &&
      typeof d.lat === 'number' &&
      typeof d.lng === 'number'
    );
    const activeDroneIds = new Set(activeFlyingDrones.map(d => d.id));

    // Remove any markers & corridors for drones that are NOT actively flying
    // (e.g. drones in standby / idle / docked at hub, or removed drones)
    Object.keys(droneMarkers.current).forEach(id => {
      if (!activeDroneIds.has(id)) {
        map.removeLayer(droneMarkers.current[id]);
        delete droneMarkers.current[id];
      }
    });

    Object.keys(missionCorridors.current).forEach(id => {
      if (!activeDroneIds.has(id)) {
        const item = missionCorridors.current[id];
        if (item.line) map.removeLayer(item.line);
        if (item.targetMarker) map.removeLayer(item.targetMarker);
        delete missionCorridors.current[id];
      }
    });

    // Auto-fit map whenever a NEW drone starts DELIVERING (new dispatch detected)
    const currentDeliveringIds = new Set(
      drones.filter(d => d.status === 'DELIVERING' || d.status === 'RETURNING').map(d => d.id)
    );
    const hasNewDelivery = [...currentDeliveringIds].some(id => !prevDeliveringIds.current.has(id));
    if (hasNewDelivery || (!hasInitialFit.current && drones.length > 0)) {
      hasInitialFit.current = true;
      setTimeout(() => fitFleetBounds(), 300);
    }
    prevDeliveringIds.current = currentDeliveringIds;

    // Render ONLY active flying drones (no cluster at the hub!)
    activeFlyingDrones.forEach(drone => {
      const isSelected = drone.id === selectedDroneId;
      const batteryNum = Number(drone.battery_pct ?? 100);
      const icon = droneIcon(drone, isSelected);

      const altNum = Number(drone.altitude_m ?? 120);
      const spdNum = Number(drone.speed_kmh ?? 50);
      const wndNum = Number(drone.wind_gust_ms ?? 4);
      const fsiNum = Number(drone.fsi ?? 88);

      const popupContent = `
        <div style="font-family:Inter,sans-serif;min-width:200px;color:#e8f4ff;padding:4px 0">
          <div style="font-weight:900;color:#00d4ff;font-size:14px;margin-bottom:3px">🚁 ${drone.id}</div>
          <div style="font-size:11px;color:#7ba3cc;margin-bottom:8px">${drone.model || 'Aero Drone'} • <strong style="color:#06ffa5">${drone.status}</strong></div>
          <div style="font-size:11px;color:#fbbf24;margin-bottom:6px">📦 Order: <strong>${drone.order_id || 'STANDBY'}</strong></div>
          <div style="font-size:11px;color:#e2e8f0;margin-bottom:8px">🎯 Target: <strong>${drone.destination_name || 'Mumbai Airspace'}</strong></div>
          <div style="font-size:10.5px;color:#94a3b8;margin-bottom:6px">👤 Agent: <strong>${drone.agent_name || 'Dispatch Officer'}</strong></div>
          <div style="font-size:10.5px;color:#06ffa5;margin-bottom:6px">⚡ Routing: <strong>${drone.algorithm || 'A* Shortest Path'}</strong></div>
          ${drone.redzones_avoided && drone.redzones_avoided.length > 0 ? `<div style="font-size:10px;color:#fbbf24;margin-bottom:6px">🛡️ Avoided: <strong>${drone.redzones_avoided.join(', ')}</strong></div>` : ''}
          <table style="width:100%;border-collapse:collapse;font-size:11.5px">
            <tr><td style="color:#7ba3cc;padding:2px 0">Battery</td><td style="text-align:right;color:${batteryNum > 50 ? '#06ffa5' : batteryNum > 25 ? '#fbbf24' : '#ff3d57'};font-family:monospace;font-weight:700">${batteryNum.toFixed(1)}%</td></tr>
            <tr><td style="color:#7ba3cc;padding:2px 0">Altitude</td><td style="text-align:right;font-family:monospace">${altNum.toFixed(0)}m</td></tr>
            <tr><td style="color:#7ba3cc;padding:2px 0">Speed</td><td style="text-align:right;font-family:monospace">${spdNum.toFixed(1)} km/h</td></tr>
            <tr><td style="color:#7ba3cc;padding:2px 0">Wind</td><td style="text-align:right;font-family:monospace">${wndNum.toFixed(1)} m/s</td></tr>
            <tr><td style="color:#7ba3cc;padding:2px 0">FSI Safety</td><td style="text-align:right;color:${fsiNum > 65 ? '#06ffa5' : fsiNum > 35 ? '#fbbf24' : '#ff3d57'};font-family:monospace">${fsiNum.toFixed(1)}</td></tr>
          </table>
        </div>`;

      // 1. Update/Add Drone Marker
      // For PARACHUTE_DEPLOYED drones: freeze position — do NOT call setLatLng on existing marker
      const isParachutedDrone = drone.status === 'PARACHUTE_DEPLOYED';
      const parachutePopup = isParachutedDrone ? `
        <div style="font-family:Inter,sans-serif;min-width:220px;color:#e8f4ff;padding:4px 0">
          <div style="font-weight:900;color:#ff3d57;font-size:14px;margin-bottom:3px">⛑️ ${drone.id} — PARACHUTE DEPLOYED</div>
          <div style="font-size:11px;color:#888;margin-bottom:8px">${drone.model || 'Aero Drone'} • <strong style="color:#ff3d57">HALTED</strong></div>
          <div style="background:rgba(255,61,87,0.1);border:1px solid rgba(255,61,87,0.3);border-radius:6px;padding:8px;margin-bottom:8px">
            <div style="font-size:10px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Deploy Coordinates</div>
            <div style="font-size:13px;font-family:monospace;font-weight:800;color:#ff3d57">${drone.lat?.toFixed(5) ?? '?'}, ${drone.lng?.toFixed(5) ?? '?'}</div>
          </div>
          <div style="font-size:11px;color:#666">🏭 Recovery team dispatched to deploy site</div>
          <div style="font-size:10px;color:#555;margin-top:4px">Battery at deploy: ${Number(drone.battery_pct ?? 0).toFixed(1)}%</div>
        </div>` : popupContent;

      if (droneMarkers.current[drone.id]) {
        const marker = droneMarkers.current[drone.id];
        // Only update position if NOT parachuted — freeze it at deploy location
        if (!isParachutedDrone) {
          marker.setLatLng([drone.lat, drone.lng]);
        }
        marker.setIcon(icon);
        marker.setZIndexOffset(isParachutedDrone ? 5000 : isSelected ? 20000 : 10000);
        if (marker.getPopup()) marker.getPopup().setContent(parachutePopup);
      } else {
        const marker = L.marker([drone.lat, drone.lng], { icon, zIndexOffset: isParachutedDrone ? 5000 : isSelected ? 20000 : 10000 })
          .addTo(map)
          .bindPopup(parachutePopup, { maxWidth: 260 });
        marker.on('click', () => onDroneSelect?.(drone.id));
        droneMarkers.current[drone.id] = marker;
        // Auto-open popup for newly parachuted drone
        if (isParachutedDrone) setTimeout(() => marker.openPopup(), 300);
      }

      // 2. Active Flight Corridor & Target Pin — skip for parachuted (halted) drones
      if (isParachutedDrone) {
        // Remove any lingering corridor for this drone
        if (missionCorridors.current[drone.id]) {
          const item = missionCorridors.current[drone.id];
          if (item.line) map.removeLayer(item.line);
          if (item.targetMarker) map.removeLayer(item.targetMarker);
          delete missionCorridors.current[drone.id];
        }
        return; // skip corridor rendering
      }
      const hasActiveMission = typeof drone.dest_lat === 'number' && typeof drone.dest_lng === 'number';

      if (hasActiveMission) {
        const isDelivering = drone.status === 'DELIVERING' || drone.status === 'IN_FLIGHT';
        const corridorColor = isDelivering ? '#00d4ff' : '#fbbf24';

        // Connect through full A* flight path waypoints curving around obstacles
        let corridorCoords;
        if (Array.isArray(drone.flight_path) && drone.flight_path.length > 1) {
          corridorCoords = [
            [drone.lat, drone.lng],
            ...drone.flight_path.map(pt => [
              typeof pt.lat === 'number' ? pt.lat : pt[0],
              typeof pt.lng === 'number' ? pt.lng : pt[1]
            ])
          ];
        } else {
          corridorCoords = [[drone.lat, drone.lng], [drone.dest_lat, drone.dest_lng]];
        }

        if (!missionCorridors.current[drone.id]) {
          missionCorridors.current[drone.id] = {};
        }

        const entry = missionCorridors.current[drone.id];

        // Flight line
        if (entry.line) {
          entry.line.setLatLngs(corridorCoords);
          entry.line.setStyle({ color: corridorColor });
        } else {
          entry.line = L.polyline(corridorCoords, {
            color: corridorColor,
            weight: 3,
            dashArray: '8 6',
            opacity: 0.85,
            className: 'corridor-pulse-line',
          }).addTo(map);
        }

        // Target marker at destination (only if delivering to customer)
        if (isDelivering) {
          if (entry.targetMarker) {
            entry.targetMarker.setLatLng([drone.dest_lat, drone.dest_lng]);
            entry.targetMarker.setIcon(destinationTargetIcon(drone));
          } else {
            entry.targetMarker = L.marker([drone.dest_lat, drone.dest_lng], {
              icon: destinationTargetIcon(drone),
              zIndexOffset: 300,
            })
              .addTo(map)
              .bindPopup(`
                <div style="font-family:Inter,sans-serif;color:#e8f4ff;padding:4px">
                  <b style="color:#06ffa5">🎯 Delivery Destination</b><br>
                  <span style="font-size:12px;font-weight:700">${drone.destination_name}</span><br>
                  <span style="color:#7ba3cc;font-size:11px">Assigned Drone: <b>${drone.id}</b></span><br>
                  <span style="color:#fbbf24;font-size:11px">Order: <b>${drone.order_id}</b> • Agent: <b>${drone.agent_name || ''}</b></span>
                </div>
              `);
          }
        } else if (entry.targetMarker) {
          map.removeLayer(entry.targetMarker);
          entry.targetMarker = null;
        }
      } else if (missionCorridors.current[drone.id]) {
        // Drone no longer has active destination, clean up corridor
        const entry = missionCorridors.current[drone.id];
        if (entry.line) map.removeLayer(entry.line);
        if (entry.targetMarker) map.removeLayer(entry.targetMarker);
        delete missionCorridors.current[drone.id];
      }
    });

    // Auto-fit bounds on first populated load (no active deliveries yet)
    if (!hasInitialFit.current && drones.length > 0 && !drones.some(d => flyingStatuses.has(d.status))) {
      hasInitialFit.current = true;
      setTimeout(() => fitFleetBounds(), 200);
    }
  }, [drones, selectedDroneId, fitFleetBounds]);

  // Draw GA optimized route if present
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    routeLayers.current.forEach(l => map.removeLayer(l));
    routeLayers.current = [];

    if (!routeResult?.waypoints?.length) return;

    const wps = routeResult.waypoints;
    const coords = wps.map(w => [w.lat, w.lng]);

    // GA Optimized route
    const routeLine = L.polyline(coords, {
      color: '#00d4ff',
      weight: 4,
      opacity: 0.9,
    }).addTo(map);

    if (coords.length >= 2) {
      const lastTwo = coords.slice(-2);
      const landingLine = L.polyline(lastTwo, {
        color: '#06ffa5',
        weight: 5,
        opacity: 0.95,
      }).addTo(map);
      routeLayers.current.push(landingLine);
    }

    routeLayers.current.push(routeLine);

    wps.forEach((wp) => {
      if (!wp || typeof wp.lat !== 'number' || typeof wp.lng !== 'number') return;
      if (wp.type === 'origin') return; // Do not draw fake origin pin over drone or hub
      const m = L.marker([wp.lat, wp.lng], { icon: waypointIcon(wp.type), zIndexOffset: 300 })
        .addTo(map)
        .bindPopup(`<b style="color:#00d4ff">${(wp.type || 'WAYPOINT').toUpperCase()}</b><br><span style="font-size:11px;color:#7ba3cc">${Number(wp.lat).toFixed(4)}, ${Number(wp.lng).toFixed(4)}</span>`);
      routeLayers.current.push(m);
    });
  }, [routeResult]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mapRef}
        className={mapTheme === 'dark' ? 'tactical-dark-map' : ''}
        style={{ width: '100%', height: '100%', minHeight: '100%', position: 'absolute', inset: 0, borderRadius: 0, cursor: 'crosshair' }}
      />

      {/* Floating Center Fleet Button */}
      <button
        onClick={fitFleetBounds}
        id="center-fleet-btn"
        title="Frame all assigned active drones across Mumbai Airspace"
        style={{
          position: 'absolute',
          bottom: 24,
          right: 60,
          zIndex: 500,
          background: 'rgba(5, 12, 24, 0.92)',
          border: '1px solid rgba(0, 212, 255, 0.45)',
          color: '#00d4ff',
          padding: '6px 12px',
          borderRadius: 20,
          fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
          transition: 'all 140ms ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(0, 212, 255, 0.2)';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(5, 12, 24, 0.92)';
          e.currentTarget.style.color = '#00d4ff';
        }}
      >
        <span>🎯</span>
        <span>Fleet View ({drones.length} Drones)</span>
      </button>
    </div>
  );
}
