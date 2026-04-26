# Backend Service - Coruscant Transit Demand Prediction API

This service exposes a FastAPI endpoint for route-level demand prediction and operational recommendations.

## Overview

The backend:

- Loads trained model artifacts at startup.
- Enriches prediction input with contextual signals (weather, traffic, events).
- Computes demand, crowd level, and fleet adjustment guidance.
- Returns actionable suggestions for operations teams.

## Tech Stack

- `FastAPI`
- `Uvicorn`
- `pandas`
- `scikit-learn`
- `xgboost`
- `requests`
- `python-dotenv`

## Folder Contents

```text
backend/
  main.py           # FastAPI app and /predict inference flow
  utils.py          # Weather/traffic/event/route metadata helpers
  requirements.txt  # Python dependencies
```

Model artifacts are expected in project root:

```text
model/
  xgb_demand_model.pkl
  model_columns.pkl
```

## Setup

From project root (`transit-command/`):

```sh
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
```

## Run

From project root:

```sh
npm run start:backend
```

Or directly:

```sh
cd backend
..\.venv\Scripts\uvicorn main:app --reload --port 8000
```

## API

### `GET /predict`

Parameters:

- `route_id` (string, required)
- `date` (`YYYY-MM-DD`, optional)
- `time` (`HH:MM`, optional)

Example:

```sh
curl "http://localhost:8000/predict?route_id=R001&date=2026-04-27&time=09:30"
```

Success response includes:

- Route and demand estimate
- Crowd level (`Low`, `Medium`, `High`)
- Context signals (`weather`, `traffic`, `event`)
- Suggestions and fleet recommendation fields

## Operational Rules

- Service hours validation blocks requests before `05:00`.
- Input is one-hot encoded and reindexed to model training columns.
- Fleet action is derived from expected demand and usable bus capacity.

## Troubleshooting

- `ML model is not loaded`:
  - Verify files in `model/` exist and are readable.
- `Error during model inference`:
  - Confirm model compatibility with `model_columns.pkl`.
- CORS or frontend integration issues:
  - Ensure backend is running on `http://localhost:8000`.
