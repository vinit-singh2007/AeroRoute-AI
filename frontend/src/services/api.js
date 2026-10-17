// AeroRoute — API Service Layer
const API_BASE = 'http://localhost:8000';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// POST /api/optimize-route
export async function optimizeRoute(payload) {
  return apiFetch('/api/optimize-route', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// POST /api/predict-battery
export async function predictBattery(payload) {
  return apiFetch('/api/predict-battery', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// POST /api/fuzzy-safety
export async function evaluateSafety(payload) {
  return apiFetch('/api/fuzzy-safety', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// GET /api/no-fly-zones
export async function getNoFlyZones() {
  return apiFetch('/api/no-fly-zones');
}

// GET /api/drones
export async function getDrones() {
  return apiFetch('/api/drones');
}

// POST /api/drones
export async function addDrone(drone) {
  return apiFetch('/api/drones', {
    method: 'POST',
    body: JSON.stringify(drone),
  });
}

// DELETE /api/drones/:id
export async function deleteDrone(droneId) {
  return apiFetch(`/api/drones/${encodeURIComponent(droneId)}`, {
    method: 'DELETE',
  });
}

// DELETE /api/drones (clear all drones)
export async function deleteAllDrones() {
  return apiFetch('/api/drones', {
    method: 'DELETE',
  });
}

// POST /api/drones/reset
export async function resetFleet() {
  return apiFetch('/api/drones/reset', {
    method: 'POST',
  });
}

// POST /api/dispatch-mission
export async function dispatchMission(payload) {
  return apiFetch('/api/dispatch-mission', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// GET /api/missions
export async function getMissions() {
  return apiFetch('/api/missions');
}

// Database Endpoints
export async function getDatabaseStatus() {
  return apiFetch('/api/database/status');
}

export async function getDatabaseMissions(limit = 50) {
  return apiFetch(`/api/database/missions?limit=${limit}`);
}

export async function getDatabaseRoutes(limit = 20) {
  return apiFetch(`/api/database/routes?limit=${limit}`);
}

// LLM Pre-Flight Safety Advisor
export async function checkPreFlightSafety(payload) {
  return apiFetch('/api/ai/preflight-safety-check', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

