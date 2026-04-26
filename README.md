# Coruscant Transit Command 🚍

Coruscant Transit Command is an AI-powered **public transit operations platform**.  
Instead of relying only on static schedules and manual estimation, teams can predict route demand, monitor crowding risk, and take action with data-backed recommendations.

---

## Problem Statement

Transit operators often struggle to manage fleet demand dynamically across routes and time windows.  
Coruscant Transit Command solves this by enabling:

- route-level demand prediction
- context-aware operational decisions (weather, traffic, events)
- transparent admin moderation of field/user suggestions

---

## Solution Overview

Coruscant Transit Command combines:

- a **React frontend** for dashboard, analytics, maps, simulation, and prediction workflows
- a **FastAPI backend** for ML inference and recommendation generation
- a **data-driven operations layer** using route, stop, fleet, and geometry datasets

Operations teams receive prediction insights and fleet recommendations in near real-time.

---

## Architecture (Visual Representation)

```mermaid
flowchart LR
    A[👤 Transit Operator] --> B[🖥 React Frontend]
    B --> C[⚙ FastAPI Backend]
    C --> D[🤖 ML Model Artifacts]
    C --> E[🌦 Context Services]
    B --> F[🗂 Local/Static Transit Datasets]
```

---

## Prediction + Action Flow (Visual Representation)

```mermaid
sequenceDiagram
    participant U as Operator
    participant FE as Frontend
    participant API as FastAPI
    participant CTX as Context Providers
    participant ML as XGBoost Model

    U->>FE: Select route/date/time and predict
    FE->>API: GET /predict?route_id=...
    API->>CTX: Fetch weather/traffic/event signals
    API->>ML: Build feature vector and infer demand
    API-->>FE: Demand + crowd level + fleet action
    FE-->>U: Show recommendation and suggestions
```

---

## Tech Stack 🧰

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | UI, routing, and operations dashboard |
| Styling | Tailwind CSS + shadcn/ui + Radix UI | Fast, consistent component-driven design |
| Data Visualization | Recharts | Analytics charts and KPI visuals |
| Maps | Leaflet + react-leaflet | Route and stop map rendering |
| State/Data Fetching | TanStack Query | Querying and UI sync for dynamic data |
| Backend | Python + FastAPI + Uvicorn | Prediction API and orchestration |
| ML/Data | pandas + scikit-learn + xgboost | Feature prep and demand inference |
| Context Integration | requests + python-dotenv | Weather/traffic/event data access |
| JavaScript Tooling | npm scripts | Frontend build/dev/test workflows |

---

## Project Structure (Architecture View) 🏗

```mermaid
flowchart TB
    A[transit-command]
    A --> B[backend]
    A --> C[src]
    A --> D[public]
    A --> E[model]
    A --> F[scripts]
    A --> G[README.md]

    B --> B1[main.py]
    B --> B2[utils.py]
    B --> B3[back-info.md]

    C --> C1[pages]
    C --> C2[components]
    C --> C3[lib]

    D --> D1[data]
    D1 --> D11[routes.json]
    D1 --> D12[stops.json]
    D1 --> D13[buses.json]
    D1 --> D14[routes_with_geometry.json]

    E --> E1[xgb_demand_model.pkl]
    E --> E2[model_columns.pkl]
```

---

## Environment Configuration

Use local environment setup before running:

- create Python virtual environment in project root: `.venv`
- install backend dependencies from: `backend/requirements.txt`
- optional API override for frontend: `VITE_PREDICTION_API_URL`

> Important: Never commit real API secrets, keys, or production credentials.

---

## Key Features

- Route-wise demand prediction using ML inference
- Crowd level classification (`Low`, `Medium`, `High`)
- Fleet action recommendation (`increase`, `reduce`, `ok`)
- Context-aware suggestions using weather/traffic/event signals
- User suggestion submission with admin approval/rejection flow
- Analytics, simulation, and route/stops map operations views

---

## 👨‍💻 Author

Made with ❤️ by **Shreyash-devs**  
A passionate developer who enjoys turning ideas into reality using tech and a touch of creativity.

- 🔗 [LinkedIn](https://www.linkedin.com/in/shreyashdubewar)  
- 📱 [GitHub](https://github.com/shreyash-devs)  
- ✉️ shreyashdevs.work@gmail.com
