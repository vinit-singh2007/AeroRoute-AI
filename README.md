# AeroRoute — Setup Guide

## Quick Start (2 Terminals)

### Terminal 1 — Backend
```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
python main.py
```
Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

### Terminal 2 — Frontend
```bash
cd frontend
npm install        # (already done if you ran setup)
npm run dev
```
Frontend runs at: http://localhost:5173

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/optimize-route` | POST | GA route optimisation |
| `/api/predict-battery` | POST | ML battery drain prediction |
| `/api/fuzzy-safety` | POST | Fuzzy FSI evaluation |
| `/api/no-fly-zones` | GET | Return NFZ polygon data |
| `/ws/telemetry` | WebSocket | Live drone telemetry @ 1 Hz |
| `/docs` | GET | Interactive Swagger UI |

## WebSocket Commands (send as plain text)
- `SIMULATE_STORM` — Raise all drones' wind gusts to 22–28 m/s
- `FORCE_RTB` — Set all drone batteries to 15% (triggers RTB)
- `RESET` — Reinitialise simulator fleet

## Directory Structure
```
AeroRoute/
├── backend/
│   ├── main.py              # FastAPI + WebSocket server
│   ├── ml_models.py         # GradientBoosting battery model
│   ├── soft_computing.py    # GA route optimizer + Fuzzy FSI
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx           # Main dashboard layout
    │   ├── index.css         # Design system (dark neon theme)
    │   ├── components/
    │   │   ├── FleetMap.jsx         # Leaflet map
    │   │   ├── DispatchPanel.jsx    # Dispatch form + results
    │   │   ├── TelemetryHUD.jsx     # Live gauges + FSI ring
    │   │   ├── FleetOverview.jsx    # Fleet stats sidebar
    │   │   ├── EmergencyControls.jsx# Emergency overrides
    │   │   └── Toast.jsx            # Notification system
    │   ├── hooks/
    │   │   └── useTelemetry.js      # WebSocket hook
    │   └── services/
    │       └── api.js               # REST API service
    ├── index.html
    └── vite.config.js
```
