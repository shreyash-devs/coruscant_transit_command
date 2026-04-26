import os
import pickle
import pandas as pd
from datetime import datetime
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from utils import get_weather, get_traffic, get_event, get_route_metadata

app = FastAPI(title="Coruscant Transit Demand Prediction API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Models
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "model" / "xgb_demand_model.pkl"
COLUMNS_PATH = BASE_DIR / "model" / "model_columns.pkl"

model = None
model_columns = None

@app.on_event("startup")
def load_ml_assets():
    global model, model_columns
    try:
        with open(MODEL_PATH, "rb") as mf:
            model = pickle.load(mf)
        with open(COLUMNS_PATH, "rb") as cf:
            model_columns = pickle.load(cf)
        print("ML Models loaded successfully.")
    except Exception as e:
        print(f"Error loading ML models: {e}")

class PredictResponse(BaseModel):
    route_id: str
    predicted_demand: int
    crowd_level: str
    weather: str
    traffic: str
    event: str
    suggestions: list[str]
    buses_currently_running: int
    bus_capacity: int
    buses_recommended: int
    fleet_action: str   # 'increase' | 'reduce' | 'ok'

def determine_crowd_level(demand: int, capacity: int) -> str:
    # Low: <40% capacity, Medium: 40-80%, High: >80%
    if capacity <= 0:
        return "High"
    ratio = demand / capacity
    if ratio < 0.4:
        return "Low"
    elif ratio <= 0.8:
        return "Medium"
    else:
        return "High"

@app.get("/predict", response_model=PredictResponse)
def predict_demand(route_id: str = Query(..., description="Route ID"),
                   date: str = Query(None, description="YYYY-MM-DD for debug"),
                   time: str = Query(None, description="HH:MM for debug")):
    if model is None or model_columns is None:
        raise HTTPException(status_code=500, detail="ML model is not loaded.")

    # 1. Get exact current datetime or use provided date/time
    now = datetime.now()
    if date and time:
        try:
            now = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
        except ValueError:
            pass  # fallback to current time

    # 1b. Enforce service hours: buses only run 05:00 – 23:59
    if now.hour < 5:
        raise HTTPException(
            status_code=400,
            detail="Buses do not operate between 12:00 AM and 5:00 AM. Please select a time within service hours (05:00 – 23:59)."
        )

    # 2. Extract temporal features
    hour = now.hour
    minute = now.minute
    day_of_week = now.weekday()
    is_weekend = 1 if day_of_week >= 5 else 0
    month = now.month

    # 3/4/5. Fetch Contextual API data
    weather = get_weather()
    traffic = get_traffic(route_id)
    event = get_event(date if date else now.strftime("%Y-%m-%d"))

    # 6. Route Metadata mapping
    meta = get_route_metadata(route_id)
    area_type = meta["area_type"]
    bus_capacity = meta["bus_capacity"]
    buses_required = meta["buses_required"]
    avg_passengers_per_bus = meta["avg_passengers_per_bus"]

    # 7. Build Input Dictionary (matches exact training features)
    # The pipeline step requires: hour, minute, day_of_week, is_weekend, month, and categorical strings.
    input_dict = {
        "hour": hour,
        "hour_from_time": hour,
        "minute": minute,
        "day_of_week": day_of_week,
        "month": month,
        "is_weekend": is_weekend,
        "route_id": route_id.lower().strip(),
        "area_type": area_type.lower().strip(),
        "weather": weather.lower().strip(),
        "traffic_level": traffic.lower().strip(),
        "event": event.lower().strip(),
        "bus_capacity": bus_capacity,
        "buses_required": buses_required,
        "avg_passengers_per_bus": avg_passengers_per_bus,
    }

    # Create a DataFrame with a single row
    df = pd.DataFrame([input_dict])

    # 8. Apply Preprocessing (pd.get_dummies and reindex)
    df_encoded = pd.get_dummies(df)
    df_aligned = df_encoded.reindex(columns=model_columns, fill_value=0)

    # 9. Predict using XGBoost (trained via Grid Search)
    try:
        # Note: 'xgb::Grid' refers to the XGBoost model optimized via GridSearchCV 
        # for finding the best hyperparameters like max_depth and learning_rate.
        prediction = model.predict(df_aligned)[0]
        # Ensure prediction is non-negative
        predicted_demand = max(0, int(round(prediction)))

        # --- TACTICAL OVERRIDE FOR PMPML SPECIFIC EVENTS ---
        # Ambedkar Jayanti (April 14) is a massive event in Pune, centered around PMC (Manapa).
        # We override standard XGB output if it underestimates the festival demand.
        if month == 4 and now.day == 14 and 7 <= hour <= 21:
            # Shift multiplier based on node importance
            is_hub = "manapa" in route_id.lower() or "pmc" in route_id.lower()
            multiplier = 2.3 if is_hub else 1.7
            predicted_demand = int(predicted_demand * multiplier)
            print(f"[REBALANCING_INTEL] Ambedkar Jayanti Override Activated for {route_id}. Multiplier: {multiplier}")
    except Exception as e:
        print(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail="Error during model inference.")

    # 10. Convert to crowd level
    # Capacity is bus_capacity * buses_required
    total_capacity = bus_capacity * buses_required
    crowd_level = determine_crowd_level(predicted_demand, total_capacity)

    # 11. Generate suggestions
    suggestions = []

    if weather in ["rainy", "foggy"]:
        suggestions.append(f"Since it's {weather}, roads might be slippery and visibility could be low. Please remind drivers to drive carefully and expect slight delays.")

    if traffic == "high":
        suggestions.append("Traffic is currently heavy along this route. Buses are likely to be delayed, so it's a good idea to update the passenger display boards.")

    if event in ["festival", "local event", "weekend rush"]:
        suggestions.append(f"Because of the {event}, you might see large groups of people waiting at certain stops. Keep an eye out for sudden crowding.")

    # Fleet adjustment recommendation
    buses_recommended = max(1, -(-predicted_demand // int(bus_capacity * 0.8)))
    buses_delta = buses_recommended - buses_required
    if buses_delta > 0:
        fleet_action = "increase"
        fleet_suggestion = f"The model predicts {predicted_demand} passengers but the current {buses_required} bus(es) (capacity {bus_capacity}/bus) can comfortably carry only {int(buses_required * bus_capacity * 0.8)}. Please deploy {buses_delta} more bus(es) to avoid overcrowding."
    elif buses_delta < 0:
        fleet_action = "reduce"
        fleet_suggestion = f"Only {predicted_demand} passengers expected. Your current {buses_required} buses have plenty of room. You can safely remove {abs(buses_delta)} bus(es) from this route to save fuel and operating costs."
    else:
        fleet_action = "ok"
        fleet_suggestion = f"The current {buses_required} bus(es) on this route are just right for the expected {predicted_demand} passengers. No fleet changes needed."

    suggestions.append(fleet_suggestion)

    # 12. Return JSON response
    return PredictResponse(
        route_id=route_id,
        predicted_demand=predicted_demand,
        crowd_level=crowd_level,
        weather=weather,
        traffic=traffic,
        event=event,
        suggestions=suggestions,
        buses_currently_running=buses_required,
        bus_capacity=bus_capacity,
        buses_recommended=buses_recommended,
        fleet_action=fleet_action,
    )
