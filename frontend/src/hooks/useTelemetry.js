// AeroRoute — WebSocket hook for live drone telemetry
import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL = 'ws://localhost:8000/ws/telemetry';

export function useTelemetry() {
  const [drones, setDrones] = useState([]);
  const [hub, setHub] = useState({ lat: 19.1940, lng: 72.8550 });
  const [weather, setWeather] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const pingTimer = useRef(null);
  const isUnmounted = useRef(false);

  const connect = useCallback(() => {
    if (isUnmounted.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted.current) {
          ws.close();
          return;
        }
        setConnected(true);
        clearTimeout(reconnectTimer.current);

        // Keep-alive heartbeat every 10 seconds
        clearInterval(pingTimer.current);
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('PING');
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        if (event.data === 'PONG') return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'telemetry') {
            setDrones(prevDrones => {
              const incoming = data.drones || [];
              const prevMap = new Map((prevDrones || []).map(d => [d.id, d]));
              return incoming.map(inc => {
                const prev = prevMap.get(inc.id);
                return {
                  ...prev,
                  ...inc,
                  max_payload_kg: inc.max_payload_kg ?? prev?.max_payload_kg ?? 3.5,
                  max_speed_kmh: inc.max_speed_kmh ?? prev?.max_speed_kmh ?? 65.0,
                };
              });
            });
            if (data.hub) setHub(data.hub);
            if (data.weather) setWeather(data.weather);
            setLastUpdate(new Date());
          }
        } catch { /* ignore non-json messages */ }
      };

      ws.onclose = () => {
        clearInterval(pingTimer.current);
        if (!isUnmounted.current) {
          setConnected(false);
          // Swift auto-reconnect after 1.5 seconds
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = setTimeout(connect, 1500);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(connect, 2000);
    }
  }, []);

  useEffect(() => {
    isUnmounted.current = false;
    connect();

    // Initial hydration fetch
    fetch('http://localhost:8000/api/drones')
      .then(res => res.json())
      .then(data => {
        if (!isUnmounted.current && data.drones && data.drones.length > 0) {
          setDrones(data.drones);
          setConnected(true);
          setLastUpdate(new Date());
        }
      })
      .catch(() => { });

    return () => {
      isUnmounted.current = true;
      clearInterval(pingTimer.current);
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendCommand = useCallback((cmd) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(cmd);
    }
  }, []);

  const refreshFleet = useCallback(() => {
    fetch('http://localhost:8000/api/drones')
      .then(res => res.json())
      .then(data => {
        if (!isUnmounted.current && data.drones) {
          setDrones(data.drones);
          setLastUpdate(new Date());
        }
      })
      .catch(() => { });
  }, []);

  const simulateStorm = useCallback(() => sendCommand('SIMULATE_STORM'), [sendCommand]);
  const forceRTB = useCallback(() => sendCommand('FORCE_RTB'), [sendCommand]);
  const resetFleet = useCallback(() => sendCommand('RESET'), [sendCommand]);
  const clearFleet = useCallback(() => sendCommand('CLEAR_FLEET'), [sendCommand]);

  return { drones, hub, weather, connected, lastUpdate, refreshFleet, simulateStorm, forceRTB, resetFleet, clearFleet };
}
