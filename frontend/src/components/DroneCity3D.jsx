// AeroRoute AI — DroneCity3D
// Genuine 3D city scene built with React Three Fiber + Three.js
// Real 3D buildings (procedural instanced), 3D drone geometry, orbit/follow camera
// Zero billing — no paid API keys

import { useRef, useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  ArrowLeft, Play, Pause, RotateCw, Sliders, Battery,
  Navigation, Layers, AlertTriangle, Radio, MapPin, Zap,
} from 'lucide-react';
import { optimizeRoute } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const ANCHOR_LAT = 19.1940;
const ANCHOR_LNG = 72.8550;

function gpsToWorld(lat, lng) {
  const x = (lng - ANCHOR_LNG) * 111000 * Math.cos((ANCHOR_LAT * Math.PI) / 180) / 8;
  const z = -(lat - ANCHOR_LAT) * 111000 / 8;
  return [x, z];
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL CITY DATA (computed once at module load)
// ─────────────────────────────────────────────────────────────────────────────
const CITY_BUILDINGS = (() => {
  const out = [];
  let s = 42;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const BLOCKS = 22, BLOCK = 9, STREET = 4;
  for (let bx = -BLOCKS / 2; bx < BLOCKS / 2; bx++) {
    for (let bz = -BLOCKS / 2; bz < BLOCKS / 2; bz++) {
      if (bx % 4 === 0 || bz % 4 === 0) continue;
      const cx = bx * (BLOCK + STREET) + BLOCK / 2;
      const cz = bz * (BLOCK + STREET) + BLOCK / 2;
      const dist = Math.sqrt(cx * cx + cz * cz);
      const hs = Math.max(0.25, 1.0 - dist / 95);
      const rnd = r();
      const h = 5 + rnd * 55 * hs + (rnd > 0.78 ? rnd * 110 * hs : 0);
      const w = BLOCK * (0.55 + r() * 0.35);
      const d = BLOCK * (0.55 + r() * 0.35);
      // Brighter, more visible building colors — steel blue palette
      let col;
      if (h > 100) col = new THREE.Color(0x1a6faa);       // tall: bright steel blue
      else if (h > 50) col = new THREE.Color(0x174f82);   // mid: medium blue
      else if (h > 25) col = new THREE.Color(0x0f3660);   // short-mid: dark blue
      else col = new THREE.Color(0x0a2040);                // low: darkest
      // Roof glow for tall buildings
      const roofCol = h > 80
        ? new THREE.Color(0x00d4ff).lerp(new THREE.Color(0x1a5080), 1 - h / 200)
        : new THREE.Color(0x1f4570);
      out.push({ cx, cz, h, w, d, col, roofCol });
    }
  }
  return out;
})();

// ─────────────────────────────────────────────────────────────────────────────
// CITY BUILDINGS — instanced mesh
// ─────────────────────────────────────────────────────────────────────────────
function CityBuildings({ offsetX = 0, offsetZ = 0 }) {
  const bodyRef = useRef();
  const roofRef = useRef();

  useEffect(() => {
    if (!bodyRef.current || !roofRef.current) return;
    const dummy = new THREE.Object3D();
    CITY_BUILDINGS.forEach((b, i) => {
      dummy.position.set(b.cx, b.h / 2, b.cz);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      bodyRef.current.setMatrixAt(i, dummy.matrix);
      bodyRef.current.setColorAt(i, b.col);

      dummy.position.set(b.cx, b.h + 0.25, b.cz);
      dummy.scale.set(b.w + 0.5, 0.5, b.d + 0.5);
      dummy.updateMatrix();
      roofRef.current.setMatrixAt(i, dummy.matrix);
      roofRef.current.setColorAt(i, b.roofCol);
    });
    bodyRef.current.instanceMatrix.needsUpdate = true;
    bodyRef.current.instanceColor.needsUpdate = true;
    roofRef.current.instanceMatrix.needsUpdate = true;
    roofRef.current.instanceColor.needsUpdate = true;
  }, []);

  return (
    <group position={[offsetX, 0, offsetZ]}>
      <instancedMesh ref={bodyRef} args={[null, null, CITY_BUILDINGS.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial metalness={0.3} roughness={0.7} vertexColors />
      </instancedMesh>
      <instancedMesh ref={roofRef} args={[null, null, CITY_BUILDINGS.length]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial metalness={0.6} roughness={0.3} vertexColors emissive="#003850" emissiveIntensity={0.7} />
      </instancedMesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUND + ROADS
// ─────────────────────────────────────────────────────────────────────────────
function Ground({ offsetX = 0, offsetZ = 0 }) {
  return (
    <group position={[offsetX, 0, offsetZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#020b18" metalness={0.05} roughness={0.95} />
      </mesh>
      <gridHelper args={[600, 60, '#0c2236', '#091828']} position={[0, 0.08, 0]} />
      {/* City boundary ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[120, 122, 64]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NO-FLY ZONES
// ─────────────────────────────────────────────────────────────────────────────
const NFZ = [
  { lat: 19.0896, lng: 72.8656, rM: 1800 },
  { lat: 19.0657, lng: 72.8680, rM: 700 },
  { lat: 19.0060, lng: 72.9150, rM: 1200 },
];

function NoFlyZones() {
  return (
    <>
      {NFZ.map((n, i) => {
        const [x, z] = gpsToWorld(n.lat, n.lng);
        const r = n.rM / 8;
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 15, 0]}>
              <cylinderGeometry args={[r, r, 30, 32, 1, true]} />
              <meshBasicMaterial color="#ff3d57" transparent opacity={0.16} side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
              <ringGeometry args={[r - 0.6, r + 0.6, 32]} />
              <meshBasicMaterial color="#ff3d57" transparent opacity={0.55} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D DRONE — body + 4 arms + rotors + LEDs
// ─────────────────────────────────────────────────────────────────────────────
function DroneModel({ lat, lng, altitudeM, heading, isFlying }) {
  const groupRef = useRef();
  const rotors = [useRef(), useRef(), useRef(), useRef()];

  const [wx, wz] = gpsToWorld(lat, lng);
  const wy = altitudeM / 8;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    // Smooth position lerp (prevent jitter)
    groupRef.current.position.lerp(
      new THREE.Vector3(wx, wy + (isFlying ? Math.sin(t * 2.2) * 0.12 : Math.sin(t * 0.9) * 0.05), wz),
      0.1
    );
    // Heading
    const targetY = -heading * Math.PI / 180;
    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.1;
    // Tilt forward when flying
    groupRef.current.rotation.x += (-0.05 * (isFlying ? 1 : 0) - groupRef.current.rotation.x) * 0.08;

    // Rotor spin
    const spd = isFlying ? 0.45 : 0.08;
    rotors.forEach((r, i) => { if (r.current) r.current.rotation.y += spd * (i % 2 === 0 ? 1 : -1); });
  });

  const ARM = 1.1;
  const ARMS = [[-ARM, -ARM], [ARM, -ARM], [-ARM, ARM], [ARM, ARM]];

  return (
    <group ref={groupRef} position={[wx, wy, wz]}>
      {/* Drop shadow/pulse on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -wy + 0.3, 0]}>
        <ringGeometry args={[1.1, 1.8, 32]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={isFlying ? 0.3 : 0.12} />
      </mesh>

      {/* Altitude drop line */}
      <mesh position={[0, -wy / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, wy, 4]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.2} />
      </mesh>

      {/* FUSELAGE */}
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.22, 0.7]} />
        <meshStandardMaterial color="#0f2035" metalness={0.82} roughness={0.28} />
      </mesh>
      {/* Top dome */}
      <mesh position={[0, 0.17, 0]}>
        <sphereGeometry args={[0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#172840" metalness={0.65} roughness={0.38} />
      </mesh>
      {/* Center LED */}
      <mesh position={[0, 0.14, 0]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={4} />
      </mesh>
      {/* Nose */}
      <mesh position={[0, 0, -0.42]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.08, 0.2, 4]} />
        <meshStandardMaterial color="#ff7700" emissive="#ff5500" emissiveIntensity={2} />
      </mesh>

      {/* ARMS + ROTORS */}
      {ARMS.map(([ax, az], i) => (
        <group key={i} position={[ax, 0, az]}>
          {/* Arm */}
          <mesh rotation={[0, Math.atan2(az, ax), 0]}>
            <boxGeometry args={[ARM * 1.55, 0.12, 0.12]} />
            <meshStandardMaterial color="#162840" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Motor housing */}
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.15, 0.12, 0.16, 8]} />
            <meshStandardMaterial color="#0c1c2e" metalness={0.92} roughness={0.18} />
          </mesh>
          {/* Rotor */}
          <group ref={rotors[i]} position={[0, 0.21, 0]}>
            <mesh>
              <boxGeometry args={[1.1, 0.04, 0.11]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#00d4ff' : '#06ffa5'} transparent opacity={0.72} metalness={0.5} />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[1.1, 0.04, 0.11]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#00d4ff' : '#06ffa5'} transparent opacity={0.72} metalness={0.5} />
            </mesh>
          </group>
          {/* Corner LED */}
          <mesh position={[0, 0.23, 0]}>
            <sphereGeometry args={[0.065, 6, 6]} />
            <meshStandardMaterial
              color={i < 2 ? '#ff3d57' : '#06ffa5'}
              emissive={i < 2 ? '#ff3d57' : '#06ffa5'}
              emissiveIntensity={3}
            />
          </mesh>
        </group>
      ))}

      {/* Landing skids */}
      {[[-0.55], [0.55]].map(([sx], i) => (
        <mesh key={i} position={[sx, -0.18, 0]}>
          <boxGeometry args={[0.1, 0.08, 1.15]} />
          <meshStandardMaterial color="#0d1e30" metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE LINES
// ─────────────────────────────────────────────────────────────────────────────
function RouteVis({ waypoints, simProgress }) {
  const allPts = useMemo(() =>
    waypoints.length < 2 ? [] :
    waypoints.map(wp => {
      const [x, z] = gpsToWorld(wp.lat, wp.lng);
      return new THREE.Vector3(x, (wp.altitude_m || 80) / 8, z);
    }),
  [waypoints]);

  const doneIdx = Math.floor(simProgress * Math.max(0, allPts.length - 1));
  const donePts = allPts.slice(0, doneIdx + 2);

  if (allPts.length < 2) return null;

  return (
    <group>
      {/* Planned (dashed orange) */}
      <Line points={allPts} color="#ff8800" lineWidth={3.5} transparent opacity={0.7} dashed dashSize={2.5} gapSize={1.2} />
      {/* Completed (solid cyan) */}
      {donePts.length >= 2 && <Line points={donePts} color="#00d4ff" lineWidth={5.5} transparent opacity={1} />}

      {/* Start sphere */}
      <mesh position={allPts[0]}>
        <sphereGeometry args={[1.4, 10, 10]} />
        <meshStandardMaterial color="#06ffa5" emissive="#06ffa5" emissiveIntensity={2.5} />
      </mesh>
      {/* Goal sphere */}
      <mesh position={allPts[allPts.length - 1]}>
        <sphereGeometry args={[1.4, 10, 10]} />
        <meshStandardMaterial color="#ff7700" emissive="#ff7700" emissiveIntensity={2.5} />
      </mesh>
      {/* Vertical poles */}
      {[allPts[0], allPts[allPts.length - 1]].map((p, i) => (
        <mesh key={i} position={[p.x, p.y / 2, p.z]}>
          <cylinderGeometry args={[0.13, 0.13, p.y, 4]} />
          <meshBasicMaterial color={i === 0 ? '#06ffa5' : '#ff7700'} transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTING + ATMOSPHERE
// ─────────────────────────────────────────────────────────────────────────────
function Lighting() {
  return (
    <>
      {/* Bright ambient to ensure buildings are visible */}
      <ambientLight intensity={0.9} color="#2060a0" />
      <directionalLight
        position={[50, 90, 40]} intensity={2.8} color="#d0e8ff" castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-far={500} shadow-camera-left={-150}
        shadow-camera-right={150} shadow-camera-top={150} shadow-camera-bottom={-150}
      />
      {/* Fill light from opposite side */}
      <directionalLight position={[-40, 50, -30]} intensity={1.2} color="#4080c0" />
      <pointLight position={[0, 80, 0]} intensity={1.5} color="#1040a0" distance={280} />
      <pointLight position={[0, 5, 0]}  intensity={0.8} color="#00d4ff" distance={90} />
      <fog attach="fog" args={['#010d20', 150, 500]} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA FOLLOW
// ─────────────────────────────────────────────────────────────────────────────
function FollowCamera({ dronePos, followDrone, orbitRef }) {
  const { camera } = useThree();

  const [tx, tz] = dronePos ? gpsToWorld(dronePos.lat, dronePos.lng) : [0, 0];
  const ty = (dronePos?.altitude || 80) / 8;

  useFrame(() => {
    if (!followDrone || !dronePos) return;
    // Camera positioned 60 units back and 40 units up from drone, angled down
    const desired = new THREE.Vector3(tx, ty + 40, tz + 60);
    camera.position.lerp(desired, 0.04);
    // Look slightly ahead of drone at mid-altitude
    const lookTarget = new THREE.Vector3(tx, ty * 0.4, tz - 20);
    camera.lookAt(lookTarget);
    if (orbitRef.current) {
      orbitRef.current.target.lerp(new THREE.Vector3(tx, ty * 0.5, tz), 0.04);
      orbitRef.current.update();
    }
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESETS
// ─────────────────────────────────────────────────────────────────────────────
const PRESETS = [
  { id: 'base',      name: 'MMR Central Base',    lat: 19.1940, lng: 72.8550 },
  { id: 'bkc',       name: 'BKC Hub',             lat: 19.0657, lng: 72.8680 },
  { id: 'andheri',   name: 'Andheri East SEEPZ',  lat: 19.1136, lng: 72.8697 },
  { id: 'kandivali', name: 'Kandivali Logistics',  lat: 19.2200, lng: 72.8400 },
  { id: 'borivali',  name: 'Borivali West',        lat: 19.2307, lng: 72.8567 },
  { id: 'powai',     name: 'Powai Tech Campus',    lat: 19.1250, lng: 72.9050 },
  { id: 'malad',     name: 'Malad Mindspace',      lat: 19.1860, lng: 72.8485 },
];

function buildLocalRoute(start, goal, altM) {
  return Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    return {
      lat: start.lat + (goal.lat - start.lat) * t,
      lng: start.lng + (goal.lng - start.lng) * t,
      altitude_m: altM * Math.sin(t * Math.PI) + 30,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function DroneCity3D({ drone, onClose, allDrones = [], onSelectDrone, onSwitchToCesium }) {
  const initLat  = drone?.lat         || 19.1940;
  const initLng  = drone?.lng         || 72.8550;
  const initAlt  = drone?.altitude_m  || drone?.altitude || 86;
  const initBatt = drone?.battery_pct !== undefined ? drone.battery_pct : 85;

  const [startPt,    setStartPt]    = useState({ id: 'base', name: 'MMR Central Base', lat: initLat, lng: initLng });
  const [goalPt,     setGoalPt]     = useState(PRESETS[1]);
  const [safeAlt,    setSafeAlt]    = useState(90);
  const [algorithm,  setAlgorithm]  = useState('ga');
  const [waypoints,  setWaypoints]  = useState([]);
  const [stats,      setStats]      = useState({ distKm: 0, etaMin: 0, drainPct: 0 });
  const [isCalc,     setIsCalc]     = useState(false);
  const [routeMsg,   setRouteMsg]   = useState('');
  const [simStatus,  setSimStatus]  = useState('idle');
  const [simProg,    setSimProg]    = useState(0);
  const [simSpeed,   setSimSpeed]   = useState(1);
  const [followDrone,setFollowDrone]= useState(true);
  const [dronePos,   setDronePos]   = useState({ lat: initLat, lng: initLng, altitude: initAlt, speed: drone?.speed_kmh || 62, battery: initBatt, heading: 0 });

  const orbitRef = useRef();
  const simTimer = useRef();

  // ── ROUTE CALC ────────────────────────────────────────────────────────
  const handleCalc = useCallback(async () => {
    setIsCalc(true); setRouteMsg(''); setSimStatus('idle'); setSimProg(0);
    try {
      let wps, distKm, etaMin, drainPct;
      if (algorithm === 'ga') {
        const res = await optimizeRoute({
          origin: { lat: startPt.lat, lng: startPt.lng },
          destination: { lat: goalPt.lat, lng: goalPt.lng },
          payload_weight_kg: drone?.max_payload_kg || 2.0,
          wind_speed_ms: 4.5,
          max_battery_drain_pct: 85.0,
        });
        wps = res.waypoints || [];
        distKm  = res.total_distance_km || 0;
        etaMin  = res.eta_minutes || 0;
        drainPct = res.battery_drain_estimate_pct || 0;
      }
      if (!wps || wps.length < 2) throw new Error('empty');
      setWaypoints(wps);
      setStats({ distKm: +distKm.toFixed(2), etaMin: +etaMin.toFixed(1), drainPct: +drainPct.toFixed(1) });
      setDronePos(p => ({ ...p, lat: wps[0].lat, lng: wps[0].lng, altitude: wps[0].altitude_m || safeAlt }));
    } catch {
      const dist = haversineKm(startPt.lat, startPt.lng, goalPt.lat, goalPt.lng);
      const wps  = buildLocalRoute(startPt, goalPt, safeAlt);
      setWaypoints(wps);
      setStats({ distKm: +dist.toFixed(2), etaMin: +(dist / 55 * 60).toFixed(1), drainPct: +(dist * 4).toFixed(1) });
      setRouteMsg('Backend unavailable — local parabolic corridor used.');
      setDronePos(p => ({ ...p, lat: wps[0].lat, lng: wps[0].lng, altitude: wps[0].altitude_m || safeAlt }));
    } finally { setIsCalc(false); }
  }, [startPt, goalPt, safeAlt, algorithm, drone]);

  // ── SIM LOOP ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (simStatus !== 'running' || waypoints.length < 2) return;
    const INC = simSpeed * 0.003 / 30;
    simTimer.current = setInterval(() => {
      setSimProg(prev => {
        const next = prev + INC;
        if (next >= 1) { setSimStatus('completed'); return 1; }
        const seg  = waypoints.length - 1;
        const si   = Math.min(seg - 1, Math.floor(next * seg));
        const st   = next * seg - si;
        const pA   = waypoints[si], pB = waypoints[si + 1];
        if (pA && pB) {
          const lat = pA.lat + (pB.lat - pA.lat) * st;
          const lng = pA.lng + (pB.lng - pA.lng) * st;
          const alt = (pA.altitude_m || safeAlt) + ((pB.altitude_m || safeAlt) - (pA.altitude_m || safeAlt)) * st;
          const dLng2 = (pB.lng - pA.lng) * Math.PI / 180;
          const la1 = pA.lat * Math.PI / 180, la2 = pB.lat * Math.PI / 180;
          const hy = Math.sin(dLng2) * Math.cos(la2);
          const hx = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng2);
          const heading = (Math.atan2(hy, hx) * 180 / Math.PI + 360) % 360;
          const battery = Math.max(1, initBatt - stats.drainPct * next);
          const speed   = Math.round(52 + Math.sin(next * 7) * 12);
          setDronePos({ lat, lng, altitude: alt, speed, battery, heading });
        }
        return next;
      });
    }, 1000 / 30);
    return () => clearInterval(simTimer.current);
  }, [simStatus, simSpeed, waypoints, safeAlt, stats.drainPct, initBatt]);

  const handleReset = () => {
    clearInterval(simTimer.current);
    setSimStatus('idle'); setSimProg(0);
    if (waypoints.length > 0) {
      const p0 = waypoints[0];
      setDronePos({ lat: p0.lat, lng: p0.lng, altitude: p0.altitude_m || safeAlt, speed: 0, battery: initBatt, heading: 0 });
    }
  };

  const handleResetCamera = () => {
    if (!orbitRef.current) return;
    orbitRef.current.target.set(0, 10, 0);
    orbitRef.current.object.position.set(0, 65, 90);
    orbitRef.current.update();
  };

  const isLowBatt = dronePos.battery <= 20;

  // ── INLINE STYLES ─────────────────────────────────────────────────────
  const panel = {
    position: 'absolute', background: 'rgba(4,10,22,0.93)',
    backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(0,212,255,0.22)', borderRadius: 12, color: '#e2e8f0',
    fontFamily: 'Inter, sans-serif',
  };
  const LBL = { fontSize: 9, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 3 };
  const VAL = { fontSize: 14, fontWeight: 800, color: '#00d4ff', fontFamily: 'JetBrains Mono, monospace' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2500, background: '#010912', display: 'flex', flexDirection: 'column' }}>

      {/* TOP HEADER */}
      <div style={{
        height: 52, padding: '0 18px', background: 'rgba(3,9,20,0.97)',
        borderBottom: '1px solid rgba(0,212,255,0.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: 'blur(20px)', zIndex: 10, boxShadow: '0 2px 30px rgba(0,0,0,0.7)',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} id="btn-exit-3d-city" style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.45)', borderRadius: 6, padding: '5px 11px', color: '#00d4ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800 }}>
            <ArrowLeft size={13} /> EXIT 3D CITY
          </button>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>{drone?.id || 'BOM-001'}</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>• {drone?.model || 'Phantom-Mumbai X7'}</span>
          <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: drone?.status === 'RTB' ? 'rgba(255,61,87,0.2)' : 'rgba(6,255,165,0.15)', border: drone?.status === 'RTB' ? '1px solid #ff3d57' : '1px solid #06ffa5', color: drone?.status === 'RTB' ? '#ff3d57' : '#06ffa5' }}>{drone?.status || 'STANDBY'}</span>
        </div>

        {allDrones.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>SWITCH:</span>
            {allDrones.map(d => (
              <button key={d.id} onClick={() => onSelectDrone?.(d.id)} style={{ padding: '3px 7px', borderRadius: 4, cursor: 'pointer', fontSize: 9.5, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', border: d.id === drone?.id ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.12)', background: d.id === drone?.id ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.03)', color: d.id === drone?.id ? '#00d4ff' : '#94a3b8' }}>{d.id}</button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onSwitchToCesium && <button onClick={onSwitchToCesium} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '3px 9px', color: '#94a3b8', fontSize: 9.5, fontWeight: 700, cursor: 'pointer' }}>Switch to Cesium</button>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(6,255,165,0.12)', border: '1px solid rgba(6,255,165,0.35)', padding: '3px 9px', borderRadius: 20, fontSize: 9.5, fontWeight: 800, color: '#06ffa5' }}>
            <Layers size={11} /><span>THREE.JS 3D ENGINE</span>
          </div>
        </div>
      </div>

      {/* MAIN 3D AREA */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* ─── THREE.JS CANVAS ─── */}
        <Canvas
          shadows
          camera={{ position: [-20, 80, 120], fov: 55, near: 0.5, far: 700 }}
          gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.4 }}
          style={{ background: 'linear-gradient(180deg, #010d20 0%, #020c1e 100%)' }}
        >
          <Suspense fallback={null}>
            <Lighting />
            <Ground offsetX={dronePos ? gpsToWorld(dronePos.lat, dronePos.lng)[0] : 0} offsetZ={dronePos ? gpsToWorld(dronePos.lat, dronePos.lng)[1] : 0} />
            <CityBuildings offsetX={dronePos ? gpsToWorld(dronePos.lat, dronePos.lng)[0] : 0} offsetZ={dronePos ? gpsToWorld(dronePos.lat, dronePos.lng)[1] : 0} />
            <NoFlyZones />
            <RouteVis waypoints={waypoints} simProgress={simProg} />
            <DroneModel
              lat={dronePos.lat}
              lng={dronePos.lng}
              altitudeM={dronePos.altitude}
              heading={dronePos.heading}
              isFlying={simStatus === 'running'}
            />
            <FollowCamera dronePos={dronePos} followDrone={followDrone} orbitRef={orbitRef} />
          </Suspense>
          <OrbitControls
            ref={orbitRef}
            enableDamping dampingFactor={0.07}
            minDistance={8} maxDistance={300}
            minPolarAngle={0.08} maxPolarAngle={Math.PI / 2.05}
            target={[0, 10, 0]}
          />
        </Canvas>

        {/* ─── LEFT PANEL: Mission Controls ─── */}
        <div style={{ ...panel, top: 14, left: 14, width: 272, padding: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8, borderBottom: '1px solid rgba(0,212,255,0.15)' }}>
            <Sliders size={13} color="#00d4ff" />
            <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>3D Mission Controls</span>
          </div>

          {/* Start */}
          <div>
            <div style={LBL}>🟢 Start Location</div>
            <select value={startPt.id} onChange={e => { const p = PRESETS.find(x => x.id === e.target.value); if (p) setStartPt(p); }} style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,212,255,0.25)', color: '#e2e8f0', borderRadius: 6, padding: '5px 7px', fontSize: 10.5, cursor: 'pointer' }}>
              {PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>{startPt.lat.toFixed(4)}°N, {startPt.lng.toFixed(4)}°E</div>
          </div>

          {/* Goal */}
          <div>
            <div style={LBL}>🎯 Goal / Landing</div>
            <select value={goalPt.id} onChange={e => { const p = PRESETS.find(x => x.id === e.target.value); if (p) setGoalPt(p); }} style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,212,255,0.25)', color: '#e2e8f0', borderRadius: 6, padding: '5px 7px', fontSize: 10.5, cursor: 'pointer' }}>
              {PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div style={{ fontSize: 9, color: '#334155', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>{goalPt.lat.toFixed(4)}°N, {goalPt.lng.toFixed(4)}°E</div>
          </div>

          {/* Algorithm */}
          <div>
            <div style={LBL}>Algorithm</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {[{id:'ga',label:'🧬 GA Optimizer'},{id:'local',label:'⚡ Local Arc'}].map(a => (
                <button key={a.id} onClick={() => setAlgorithm(a.id)} style={{ flex: 1, padding: '5px 3px', borderRadius: 6, cursor: 'pointer', fontSize: 9.5, fontWeight: 800, border: algorithm === a.id ? '1px solid #ff8800' : '1px solid rgba(255,255,255,0.1)', background: algorithm === a.id ? 'rgba(255,136,0,0.2)' : 'rgba(255,255,255,0.03)', color: algorithm === a.id ? '#ff8800' : '#64748b' }}>{a.label}</button>
              ))}
            </div>
          </div>

          {/* Altitude */}
          <div>
            <div style={{ ...LBL, display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span>Safe Altitude</span>
              <span style={{ color: '#00d4ff', fontFamily: 'JetBrains Mono, monospace' }}>{safeAlt} m</span>
            </div>
            <input type="range" min={40} max={200} value={safeAlt} onChange={e => setSafeAlt(+e.target.value)} style={{ width: '100%', accentColor: '#00d4ff' }} />
          </div>

          {/* Calculate */}
          <button onClick={handleCalc} disabled={isCalc} id="btn-calc-3d" style={{ width: '100%', padding: '9px', borderRadius: 7, cursor: isCalc ? 'wait' : 'pointer', background: isCalc ? 'rgba(0,212,255,0.06)' : 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.5)', color: '#00d4ff', fontSize: 11.5, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Navigation size={12} />{isCalc ? 'CALCULATING…' : 'CALCULATE ROUTE'}
          </button>

          {routeMsg && <div style={{ fontSize: 9, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: 5, padding: '5px 7px' }}>⚠ {routeMsg}</div>}

          {/* Sim controls */}
          {waypoints.length >= 2 && (
            <div style={{ borderTop: '1px solid rgba(0,212,255,0.12)', paddingTop: 9 }}>
              <div style={LBL}>Simulation Engine</div>
              <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
                {simStatus === 'idle' || simStatus === 'completed' ? (
                  <button onClick={() => { setSimProg(0); setSimStatus('running'); }} id="btn-start-3d" style={{ flex:2, padding:'6px', background:'rgba(6,255,165,0.15)', border:'1px solid #06ffa5', color:'#06ffa5', borderRadius:6, cursor:'pointer', fontWeight:800, fontSize:10.5, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}><Play size={11}/>START</button>
                ) : simStatus === 'running' ? (
                  <button onClick={() => setSimStatus('paused')} style={{ flex:2, padding:'6px', background:'rgba(251,191,36,0.15)', border:'1px solid #fbbf24', color:'#fbbf24', borderRadius:6, cursor:'pointer', fontWeight:800, fontSize:10.5, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}><Pause size={11}/>PAUSE</button>
                ) : (
                  <button onClick={() => setSimStatus('running')} style={{ flex:2, padding:'6px', background:'rgba(6,255,165,0.15)', border:'1px solid #06ffa5', color:'#06ffa5', borderRadius:6, cursor:'pointer', fontWeight:800, fontSize:10.5, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}><Play size={11}/>RESUME</button>
                )}
                <button onClick={handleReset} style={{ flex:1, padding:'6px', background:'rgba(255,61,87,0.1)', border:'1px solid rgba(255,61,87,0.4)', color:'#ff3d57', borderRadius:6, cursor:'pointer', fontWeight:800, fontSize:10.5, display:'flex', alignItems:'center', justifyContent:'center' }}><RotateCw size={11}/></button>
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                {[1,2,5].map(s => (
                  <button key={s} onClick={() => setSimSpeed(s)} style={{ flex:1, padding:'3px', fontSize:9, fontWeight:800, borderRadius:4, cursor:'pointer', border: simSpeed===s?'1px solid #00d4ff':'1px solid rgba(255,255,255,0.1)', background: simSpeed===s?'rgba(0,212,255,0.18)':'rgba(255,255,255,0.03)', color: simSpeed===s?'#00d4ff':'#64748b' }}>{s}× SPD</button>
                ))}
              </div>

              {simProg > 0 && (
                <div style={{ marginTop: 7 }}>
                  <div style={{ ...LBL, display:'flex', justifyContent:'space-between', marginBottom:3 }}><span>FLIGHT PROGRESS</span><span style={{color:'#00d4ff'}}>{Math.round(simProg*100)}%</span></div>
                  <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:4 }}>
                    <div style={{ height:'100%', width:`${simProg*100}%`, background:'linear-gradient(90deg,#00d4ff,#06ffa5)', borderRadius:4, transition:'width 200ms' }}/>
                  </div>
                </div>
              )}

              <label style={{ display:'flex', alignItems:'center', gap:5, marginTop:7, cursor:'pointer' }}>
                <input type="checkbox" checked={followDrone} onChange={e => setFollowDrone(e.target.checked)} style={{ accentColor:'#00d4ff' }}/>
                <span style={{ fontSize:10, color:'#94a3b8', fontWeight:600 }}>Camera Follow Drone</span>
              </label>
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL: Telemetry HUD ─── */}
        <div style={{ ...panel, top: 14, right: 14, width: 252, padding: 14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:8, borderBottom:'1px solid rgba(0,212,255,0.15)', marginBottom:11 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <Radio size={12} color="#00d4ff"/>
              <span style={{ fontSize:10.5, fontWeight:800, color:'#00d4ff', textTransform:'uppercase', letterSpacing:'1px' }}>3D Flight HUD</span>
            </div>
            <span style={{ fontSize:8.5, fontWeight:800, padding:'2px 6px', borderRadius:10, background: simStatus==='running'?'rgba(6,255,165,0.18)':'rgba(100,116,139,0.15)', border: simStatus==='running'?'1px solid #06ffa5':'1px solid rgba(100,116,139,0.4)', color: simStatus==='running'?'#06ffa5':'#64748b' }}>{simStatus.toUpperCase()}</span>
          </div>

          <div style={{ fontSize:17, fontWeight:900, color:'#fff', fontFamily:'JetBrains Mono, monospace', marginBottom:11 }}>{drone?.id||'BOM-001'}</div>

          {isLowBatt && (
            <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(255,61,87,0.15)', border:'1px solid rgba(255,61,87,0.5)', borderRadius:6, padding:'5px 7px', marginBottom:9 }}>
              <AlertTriangle size={11} color="#ff3d57"/>
              <span style={{ fontSize:9.5, color:'#ff3d57', fontWeight:800 }}>CRITICAL LOW BATTERY</span>
            </div>
          )}

          {[
            { icon:<Navigation size={10}/>, l:'Altitude',      v:`${dronePos.altitude.toFixed(1)} m` },
            { icon:<Zap size={10}/>,        l:'Ground Speed',  v:`${dronePos.speed.toFixed(0)} km/h` },
            { icon:<MapPin size={10}/>,     l:'GPS Coords',    v:`${dronePos.lat.toFixed(5)}°N\n${dronePos.lng.toFixed(5)}°E`, wide:true },
          ].map(({icon,l,v,wide}) => (
            <div key={l} style={{ marginBottom:9 }}>
              <div style={{ ...LBL, display:'flex', alignItems:'center', gap:3 }}>{icon}{l}</div>
              <div style={{ ...VAL, fontSize: wide?10.5:14, whiteSpace:'pre' }}>{v}</div>
            </div>
          ))}

          {/* Battery */}
          <div style={{ marginBottom:9 }}>
            <div style={{ ...LBL, display:'flex', alignItems:'center', gap:3, justifyContent:'space-between' }}>
              <span style={{ display:'flex', alignItems:'center', gap:3 }}><Battery size={10}/>Battery</span>
              <span style={{ color: isLowBatt?'#ff3d57':'#06ffa5', fontFamily:'JetBrains Mono, monospace' }}>{dronePos.battery.toFixed(1)}%</span>
            </div>
            <div style={{ height:5, background:'rgba(255,255,255,0.08)', borderRadius:3, marginTop:3 }}>
              <div style={{ height:'100%', width:`${Math.min(100,dronePos.battery)}%`, borderRadius:3, transition:'width 300ms', background: isLowBatt?'#ff3d57': dronePos.battery<40?'#fbbf24':'#06ffa5' }}/>
            </div>
          </div>

          {stats.distKm > 0 && (
            <div style={{ borderTop:'1px solid rgba(0,212,255,0.12)', paddingTop:9 }}>
              <div style={{ fontSize:9.5, fontWeight:800, color:'#00d4ff', textTransform:'uppercase', letterSpacing:'1px', marginBottom:7 }}>Corridor Stats</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
                {[{l:'Distance',v:`${stats.distKm} km`},{l:'ETA',v:`${stats.etaMin} min`},{l:'Batt Drain',v:`~${stats.drainPct}%`},{l:'Progress',v:`${Math.round(simProg*100)}%`}].map(({l,v}) => (
                  <div key={l}><div style={{ ...LBL, marginBottom:2 }}>{l}</div><div style={{ fontSize:11.5, fontWeight:800, color:'#00d4ff', fontFamily:'JetBrains Mono, monospace' }}>{v}</div></div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop:9, fontSize:8.5, color:'#1e293b', textAlign:'center', fontStyle:'italic' }}>⬛ Three.js 3D City • Real-World GPS Coords</div>
        </div>

        {/* CAMERA BUTTONS */}
        <div style={{ position:'absolute', bottom:20, right:20, display:'flex', flexDirection:'column', gap:6 }}>
          {[{icon:'⌖',label:'Reset Camera',action:handleResetCamera},{icon:followDrone?'🔒':'🔓',label:followDrone?'Unfollow Drone':'Follow Drone',action:()=>setFollowDrone(f=>!f)}].map(({icon,label,action}) => (
            <button key={label} onClick={action} title={label} style={{ width:40, height:40, borderRadius:8, cursor:'pointer', background:'rgba(4,11,24,0.9)', border:'1px solid rgba(0,212,255,0.3)', color:'#00d4ff', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(12px)' }}>{icon}</button>
          ))}
        </div>

        {/* LEGEND */}
        <div style={{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:14, background:'rgba(4,11,24,0.85)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, padding:'5px 14px', fontSize:9, fontWeight:700, color:'#475569', backdropFilter:'blur(12px)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}><span style={{ display:'inline-block', width:16, height:2, background:'#ff8800' }}/> Planned</span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}><span style={{ display:'inline-block', width:16, height:2, background:'#00d4ff' }}/> Done</span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}><span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:'#06ffa5' }}/> Start</span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}><span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:'#ff7700' }}/> Goal</span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}><span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:'#ff3d57' }}/> NFZ</span>
          <span style={{ color:'#1e293b' }}>Scroll=Zoom • Drag=Orbit • R-Drag=Pan</span>
        </div>
      </div>
    </div>
  );
}
