// AeroRoute — Interactive Fleet Map (Mumbai Logistics Network)
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default icon path issue in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom SVG drone marker
function droneIcon(battery, status) {
  const color =
    status === 'RTB'         ? '#ff3d57' :
    status === 'RETURNING'   ? '#fbbf24' :
    battery < 25             ? '#ff3d57' :
    battery < 50             ? '#fbbf24' : '#06ffa5';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx="19" cy="19" r="17" fill="rgba(5,12,24,0.85)" stroke="${color}" stroke-width="1.5" filter="url(#glow)"/>
      <rect x="15" y="15" width="8" height="8" rx="2" fill="${color}" opacity="0.9"/>
      <line x1="8" y1="11" x2="15" y2="16" stroke="${color}" stroke-width="1.5" opacity="0.7"/>
      <line x1="30" y1="11" x2="23" y2="16" stroke="${color}" stroke-width="1.5" opacity="0.7"/>
      <line x1="8"  y1="27" x2="15" y2="22" stroke="${color}" stroke-width="1.5" opacity="0.7"/>
      <line x1="30" y1="27" x2="23" y2="22" stroke="${color}" stroke-width="1.5" opacity="0.7"/>
      <circle cx="8"  cy="10" r="3.5" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.8"/>
      <circle cx="30" cy="10" r="3.5" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.8"/>
      <circle cx="8"  cy="28" r="3.5" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.8"/>
      <circle cx="30" cy="28" r="3.5" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.8"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  });
}

function hubIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <defs>
        <filter id="hub-glow"><feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx="22" cy="22" r="20" fill="rgba(0,212,255,0.12)" stroke="#00d4ff" stroke-width="1.5" filter="url(#hub-glow)"/>
      <circle cx="22" cy="22" r="10" fill="rgba(0,212,255,0.25)"/>
      <text x="22" y="27" text-anchor="middle" font-size="14" fill="#00d4ff">🏭</text>
    </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [44, 44], iconAnchor: [22, 22] });
}

function waypointIcon(type) {
  const isOrigin = type === 'origin';
  const isDest   = type === 'destination';
  const color = isDest ? '#06ffa5' : isOrigin ? '#00d4ff' : '#7c3aed';
  const emoji = isDest ? '📦' : isOrigin ? '🚁' : '📍';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="rgba(5,12,24,0.9)" stroke="${color}" stroke-width="2"/>
      <text x="16" y="21" text-anchor="middle" font-size="13">${emoji}</text>
    </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18] });
}

export default function FleetMap({
  drones,
  hub,
  routeResult,
  selectedDroneId,
  onDroneSelect,
  onMapClick,
  customDestination,
  sidebarState,
  mapTheme = 'satellite',
}) {
  const mapRef            = useRef(null);
  const mapInstance       = useRef(null);
  const tileLayerRef      = useRef(null);
  const droneMarkers      = useRef({});
  const routeLayers       = useRef([]);
  const hubMarker         = useRef(null);
  const customDestMarker  = useRef(null);
  const nfzLayers         = useRef([]);

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
    } catch {}
    const t1 = setTimeout(() => {
      try { mapInstance.current?.invalidateSize(); } catch {}
    }, 50);
    const t2 = setTimeout(() => {
      try { mapInstance.current?.invalidateSize(); } catch {}
    }, 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [sidebarState]);

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
      center: [19.1800, 72.8650], // Centered to frame MMR from South Bombay to Virar
      zoom:   11,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Attach initial tile layer immediately on map creation
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

    // Map click event
    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    mapInstance.current = map;

    // Draw Mumbai Logistics Hub (MMR Midpoint)
    if (hub) {
      hubMarker.current = L.marker([hub.lat, hub.lng], { icon: hubIcon() })
        .addTo(map)
        .bindPopup('<b style="color:#00d4ff">AeroRoute Mumbai Hub</b><br><span style="color:#7ba3cc;font-size:11px">MMR Midpoint Logistics Base (Kandivali/Goregaon)</span>');
    }

    // Draw Mumbai No-Fly Zones
    const mumbaiNFZ = [
      { center: [19.0896, 72.8656], radius: 2200, name: 'CSMIA International Airport Exclusion Zone' },
      { center: [18.9150, 72.8300], radius: 1500, name: 'Colaba Naval Dockyard Military Restricted Area' },
      { center: [19.0060, 72.9150], radius: 1400, name: 'BARC Trombay Nuclear Security Zone' },
      { center: [18.9430, 72.7950], radius:  800, name: 'Malabar Hill VIP Security Corridor' },
    ];

    mumbaiNFZ.forEach(zone => {
      const circle = L.circle(zone.center, {
        radius:      zone.radius,
        color:       '#ff3d57',
        fillColor:   '#ff3d57',
        fillOpacity: 0.14,
        weight:      2,
        dashArray:   '6 4',
        opacity:     0.8,
      }).addTo(map);
      circle.bindPopup(`
        <div style="font-family:Inter,sans-serif;color:#e8f4ff;background:#0d1930;padding:6px;border-radius:6px">
          <b style="color:#ff3d57">🚫 ${zone.name}</b><br>
          <span style="color:#7ba3cc;font-size:11px">Geofenced No-Fly Radius: ${zone.radius}m</span>
        </div>`);
      nfzLayers.current.push(circle);
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 80);
    setTimeout(() => {
      map.invalidateSize();
    }, 300);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update hub marker position
  useEffect(() => {
    if (!mapInstance.current || !hub) return;
    if (hubMarker.current) {
      hubMarker.current.setLatLng([hub.lat, hub.lng]);
    } else {
      hubMarker.current = L.marker([hub.lat, hub.lng], { icon: hubIcon() })
        .addTo(mapInstance.current)
        .bindPopup('<b style="color:#00d4ff">AeroRoute Mumbai Hub</b><br><span style="color:#7ba3cc;font-size:11px">BKC Central Logistics Base</span>');
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

  // Update drone markers in real-time
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    // Track active drone IDs
    const currentIds = new Set(drones.map(d => d.id));

    // Remove obsolete markers for drones deleted by user
    Object.keys(droneMarkers.current).forEach(id => {
      if (!currentIds.has(id)) {
        map.removeLayer(droneMarkers.current[id]);
        delete droneMarkers.current[id];
      }
    });

    drones.forEach(drone => {
      if (!drone || typeof drone.lat !== 'number' || typeof drone.lng !== 'number') return;
      const isSelected = drone.id === selectedDroneId;
      const batteryNum = Number(drone.battery_pct ?? 100);
      const icon = droneIcon(batteryNum, drone.status);

      const altNum = Number(drone.altitude_m ?? 120);
      const spdNum = Number(drone.speed_kmh ?? 45);
      const wndNum = Number(drone.wind_gust_ms ?? 4);
      const fsiNum = Number(drone.fsi ?? 85);
      const actStatus = drone.action_status || drone.status || 'SAFE';

      const popupContent = `
        <div style="font-family:Inter,sans-serif;min-width:180px;color:#e8f4ff">
          <div style="font-weight:800;color:#00d4ff;margin-bottom:6px">🚁 ${drone.id}</div>
          <div style="font-size:11px;color:#7ba3cc;margin-bottom:8px">${drone.model || 'Aero Drone'}</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <tr><td style="color:#7ba3cc;padding:2px 0">Battery</td><td style="text-align:right;color:${batteryNum > 50 ? '#06ffa5' : batteryNum > 25 ? '#fbbf24' : '#ff3d57'};font-family:monospace">${batteryNum.toFixed(1)}%</td></tr>
            <tr><td style="color:#7ba3cc;padding:2px 0">Altitude</td><td style="text-align:right;font-family:monospace">${altNum.toFixed(0)}m</td></tr>
            <tr><td style="color:#7ba3cc;padding:2px 0">Speed</td><td style="text-align:right;font-family:monospace">${spdNum.toFixed(1)} km/h</td></tr>
            <tr><td style="color:#7ba3cc;padding:2px 0">Wind</td><td style="text-align:right;font-family:monospace">${wndNum.toFixed(1)} m/s</td></tr>
            <tr><td style="color:#7ba3cc;padding:2px 0">FSI</td><td style="text-align:right;color:${fsiNum > 65 ? '#06ffa5' : fsiNum > 35 ? '#fbbf24' : '#ff3d57'};font-family:monospace">${fsiNum.toFixed(1)}</td></tr>
            <tr><td style="color:#7ba3cc;padding:2px 0">Status</td><td style="text-align:right;color:#00d4ff">${actStatus}</td></tr>
          </table>
        </div>`;

      if (droneMarkers.current[drone.id]) {
        const marker = droneMarkers.current[drone.id];
        marker.setLatLng([drone.lat, drone.lng]);
        marker.setIcon(icon);
        if (marker.getPopup()) marker.getPopup().setContent(popupContent);
      } else {
        const marker = L.marker([drone.lat, drone.lng], { icon, zIndexOffset: isSelected ? 1000 : 0 })
          .addTo(map)
          .bindPopup(popupContent, { maxWidth: 220 });
        marker.on('click', () => onDroneSelect(drone.id));
        droneMarkers.current[drone.id] = marker;
      }
    });
  }, [drones, selectedDroneId]);

  // Draw GA optimized route
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    // Clear previous route layers
    routeLayers.current.forEach(l => map.removeLayer(l));
    routeLayers.current = [];

    if (!routeResult?.waypoints?.length) return;

    const wps = routeResult.waypoints;
    const coords = wps.map(w => [w.lat, w.lng]);

    // GA Optimized route — blue
    const routeLine = L.polyline(coords, {
      color:   '#00d4ff',
      weight:  3.5,
      opacity: 0.9,
    }).addTo(map);

    // Safe landing corridor — last segment green
    if (coords.length >= 2) {
      const lastTwo = coords.slice(-2);
      const landingLine = L.polyline(lastTwo, {
        color:   '#06ffa5',
        weight:  4.5,
        opacity: 0.95,
      }).addTo(map);
      routeLayers.current.push(landingLine);
    }

    routeLayers.current.push(routeLine);

    // Waypoint markers
    wps.forEach((wp) => {
      if (!wp || typeof wp.lat !== 'number' || typeof wp.lng !== 'number') return;
      const m = L.marker([wp.lat, wp.lng], { icon: waypointIcon(wp.type) })
        .addTo(map)
        .bindPopup(`<b style="color:#00d4ff">${(wp.type || 'WAYPOINT').toUpperCase()}</b><br><span style="font-size:11px;color:#7ba3cc">${Number(wp.lat).toFixed(4)}, ${Number(wp.lng).toFixed(4)}</span>`);
      routeLayers.current.push(m);
    });

    map.fitBounds(routeLine.getBounds(), { padding: [45, 45] });
  }, [routeResult]);

  return (
    <div
      ref={mapRef}
      className={mapTheme === 'dark' ? 'tactical-dark-map' : ''}
      style={{ width: '100%', height: '100%', minHeight: '100%', position: 'absolute', inset: 0, borderRadius: 0, cursor: 'crosshair' }}
    />
  );
}
