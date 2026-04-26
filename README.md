# Coruscant Transit Command

A full-stack transit operations platform that combines demand prediction, route-level monitoring, and human-in-the-loop incident reporting for bus network management.

## Problem Statement

Urban transit operations teams need a practical way to:

- Forecast demand by route and time window.
- Detect overcrowding risk before passenger experience degrades.
- React to contextual disruptions such as weather, traffic, and public events.
- Collect and moderate field/user suggestions in one operational workflow.

## Proposed Solution

Coruscant Transit Command provides:

- A machine learning inference API (`FastAPI`) that predicts route demand and recommends fleet actions.
- A command-center UI (`React + TypeScript`) for dashboards, analytics, simulation, maps, and prediction.
- A suggestion pipeline with admin moderation to turn user feedback into approved operational alerts.

## Architecture Overview

### Frontend

- Framework: `React 18` + `TypeScript` + `Vite`
- UI system: `Tailwind CSS`, `shadcn/ui`, `Radix UI`
- Data/UX: `TanStack Query`, `React Router`, `Recharts`, `Leaflet`
- Main pages: dashboard, analytics, prediction, suggestions, fleet, simulation, routes map, stops map.

### Backend

- Framework: `FastAPI` + `Uvicorn`
- ML/processing: `pandas`, `scikit-learn`, `xgboost`
- API endpoint: `GET /predict`
- Startup behavior: loads model artifacts from `model/`.

### Data Layer

- Static operational datasets in `public/data/` (routes, stops, buses, geometry, suggestions).
- Suggestion status is maintained via browser storage + development sync API.

## Project Structure

```text
transit-command/
  backend/                  # FastAPI inference service and utility providers
  model/                    # Serialized ML model artifacts (.pkl)
  public/data/              # Route/stop/bus/suggestions datasets
  scripts/                  # Dataset generation utilities
  src/
    components/             # Reusable UI and layout components
    lib/                    # API clients and domain utilities
    pages/                  # Route-level application screens
```

## Key Features

- Demand prediction by `route_id` with optional date/time override.
- Crowd level classification (`Low`, `Medium`, `High`) from predicted load vs capacity.
- Fleet recommendation (`increase`, `reduce`, `ok`) with actionable guidance.
- Weather/traffic/event-aware suggestion generation.
- Suggestion submission and admin review workflow.
- Operational maps and simulation views for route/stops intelligence.

## Tech Stack

### Frontend

- `React`, `TypeScript`, `Vite`
- `React Router`, `TanStack Query`
- `Tailwind CSS`, `shadcn/ui`, `Radix UI`
- `Recharts`, `Leaflet`, `react-leaflet`

### Backend

- `Python`, `FastAPI`, `Uvicorn`
- `pandas`, `scikit-learn`, `xgboost`
- `requests`, `python-dotenv`

## Getting Started

## Prerequisites

- `Node.js` 18+ and `npm`
- `Python` 3.10+ recommended
- Windows PowerShell (commands below are PowerShell-friendly)

### 1) Clone and install frontend dependencies

```sh
git clone https://github.com/shreyash-devs/coruscant_transit_command.git
cd coruscant_transit_command/transit-command
npm install
```

### 2) Create Python virtual environment and install backend dependencies

```sh
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
```

### 3) Run full stack (frontend + backend)

```sh
npm run start
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:8000`

## Available Scripts

- `npm run dev` - Start frontend only.
- `npm run start:backend` - Start backend only.
- `npm run start` - Run frontend and backend concurrently.
- `npm run build` - Production build.
- `npm run preview` - Preview production build locally.
- `npm run lint` - Run ESLint checks.
- `npm run test` - Run test suite.
- `npm run test:watch` - Run tests in watch mode.
- `npm run routes:json` - Generate route dataset JSON.
- `npm run routes:geometry` - Generate route geometry JSON.

## API Quick Reference

### `GET /predict`

Query parameters:

- `route_id` (required)
- `date` (optional, `YYYY-MM-DD`)
- `time` (optional, `HH:MM`)

Example:

```sh
curl "http://localhost:8000/predict?route_id=R001&date=2026-04-27&time=09:30"
```

Response includes:

- `predicted_demand`
- `crowd_level`
- `weather`, `traffic`, `event`
- `suggestions`
- `buses_recommended`
- `fleet_action`

## Notes

- Service hours guard is enforced in backend (`05:00` to `23:59`).
- Ensure model artifacts exist in `model/` before starting backend.
- For backend-specific details, see `backend/back-info.md`.
