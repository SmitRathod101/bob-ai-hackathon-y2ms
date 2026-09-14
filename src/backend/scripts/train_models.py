"""
Model Training Script — ChainMind AI

Trains:
1. Delay prediction model (RandomForestRegressor)
2. Risk classification model (GradientBoostingClassifier)

Generates synthetic training data from the database, trains models, and saves them.
Run: python scripts/train_models.py

Note: These models are trained on synthetic hackathon data.
Accuracy reflects training data quality, not production-grade performance.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor, GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, accuracy_score, classification_report
from app.database.session import SessionLocal
from app.database.models import Shipment, Route, SimulationResult, SimulationRun
from app.ml.features import extract_delay_features, extract_risk_features
from app.simulation.risk_scorer import calculate_cold_chain_risk

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml_models")
os.makedirs(MODELS_DIR, exist_ok=True)

SEVERITY_MAP = {"low": 0.3, "medium": 0.6, "high": 0.9}
RISK_LABEL_MAP = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def generate_training_data(db):
    """
    Generate synthetic training data by creating varied disruption scenarios
    over the existing shipments and routes.
    """
    print("Generating training data...")
    shipments = db.query(Shipment).all()
    routes = {r.route_id: r for r in db.query(Route).all()}

    delay_X, delay_y = [], []
    risk_X, risk_y = [], []

    severities = [("low", 0.3), ("medium", 0.6), ("high", 0.9)]
    durations = [12, 24, 48, 72, 96, 120]
    cap_reductions = [0.3, 0.5, 0.75, 1.0]

    np.random.seed(42)

    for shipment in shipments:
        route = routes.get(shipment.route_id)
        if not route:
            continue

        for sev_name, sev_score in severities:
            for duration in durations:
                for cap_red in cap_reductions:
                    is_direct = np.random.random() > 0.4

                    # Compute realistic delay
                    base = duration * sev_score * cap_red
                    congestion_bonus = route.congestion * base * 0.3
                    direct_factor = 1.0 if is_direct else 0.35
                    delay = max(1.0, (base + congestion_bonus) * direct_factor)
                    # Add realistic noise
                    delay += np.random.normal(0, delay * 0.1)
                    delay = max(0.5, delay)

                    # Compute cold chain risk
                    cc_risk = calculate_cold_chain_risk(
                        shipment.temperature_sensitive,
                        shipment.required_temp_min,
                        shipment.required_temp_max,
                        shipment.current_temperature,
                        delay,
                    )

                    # Risk score
                    from app.config.settings import settings
                    delay_comp = min(1.0, delay / 120.0)
                    val_comp = min(1.0, (shipment.cargo_value or 0) / 50_000_000.0)
                    priority_comp = (5 - (shipment.priority or 3)) / 4.0
                    risk_score = (
                        settings.weight_delay * delay_comp
                        + settings.weight_cargo_value * val_comp
                        + settings.weight_cold_chain * cc_risk
                        + settings.weight_route_risk * route.risk_score
                        + settings.weight_priority * priority_comp
                    )
                    risk_score = min(1.0, max(0.0, risk_score))

                    # Risk level label
                    if risk_score < 0.3:
                        risk_label = 0  # low
                    elif risk_score < 0.5:
                        risk_label = 1  # medium
                    elif risk_score < 0.7:
                        risk_label = 2  # high
                    else:
                        risk_label = 3  # critical

                    # Delay features
                    delay_feat = extract_delay_features(
                        route_distance_km=route.distance_km,
                        route_congestion=route.congestion,
                        disruption_duration_hours=duration,
                        severity_score=sev_score,
                        priority=shipment.priority or 3,
                        route_risk=route.risk_score,
                        capacity_reduction=cap_red,
                        is_direct=is_direct,
                        cargo_value=shipment.cargo_value or 0,
                        temperature_sensitive=shipment.temperature_sensitive,
                    )
                    delay_X.append(delay_feat)
                    delay_y.append(delay)

                    # Risk features
                    risk_feat = extract_risk_features(
                        estimated_delay_hours=delay,
                        cargo_value=shipment.cargo_value or 0,
                        priority=shipment.priority or 3,
                        temperature_sensitive=shipment.temperature_sensitive,
                        route_risk=route.risk_score,
                        cold_chain_risk=cc_risk,
                        severity_score=sev_score,
                        congestion=route.congestion,
                    )
                    risk_X.append(risk_feat)
                    risk_y.append(risk_label)

    return (
        np.array(delay_X), np.array(delay_y),
        np.array(risk_X), np.array(risk_y),
    )


def train_delay_model(X, y):
    """Train RandomForest delay prediction model."""
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    print(f"  Delay Model — MAE: {mae:.2f} hours  (synthetic data baseline)")

    return model


def train_risk_model(X, y):
    """Train GradientBoosting risk classification model."""
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"  Risk Model — Accuracy: {acc:.3f}  (synthetic data baseline)")
    present_classes = sorted(set(y_test) | set(y_pred))
    class_names = ["low", "medium", "high", "critical"]
    labels = [c for c in present_classes if c < len(class_names)]
    print(f"  Classification Report:")
    print(classification_report(y_test, y_pred, labels=labels,
                                target_names=[class_names[c] for c in labels]))

    return model


def main():
    from app.database.session import init_db
    init_db()

    db = SessionLocal()
    try:
        if db.query(Shipment).count() == 0:
            print("No shipments found. Run generate_dataset.py first.")
            return

        delay_X, delay_y, risk_X, risk_y = generate_training_data(db)
        print(f"Training samples: delay={len(delay_y)}, risk={len(risk_y)}")

        print("\nTraining delay prediction model...")
        delay_model = train_delay_model(delay_X, delay_y)

        print("\nTraining risk classification model...")
        risk_model = train_risk_model(risk_X, risk_y)

        delay_path = os.path.join(MODELS_DIR, "delay_model.joblib")
        risk_path = os.path.join(MODELS_DIR, "risk_model.joblib")

        joblib.dump(delay_model, delay_path)
        joblib.dump(risk_model, risk_path)

        print(f"\n✅ Models saved:")
        print(f"   {delay_path}")
        print(f"   {risk_path}")
        print("\n⚠️  Note: Models trained on synthetic hackathon data.")
        print("   Use deterministic fallback for production reliability.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
