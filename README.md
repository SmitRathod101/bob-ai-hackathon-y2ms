# ChainMind AI — Supply Chain Crisis Simulator

> **IBM Bobathon 2025 | Track: AI**

---

## 👥 Team

| Field | Value |
|---|---|
| **Team Name** | Y2MS |
| **Track** | AI |
| **Team Lead** | Smitkumar Rathod |
| **Team Members** | Smitkumar Rathod, Yash Patel, Yaksh Patel, Mayur Kamariya |

---

## 🎯 Problem Statement

Supply chain operators currently have visibility into **what is happening now**, but lack tools to simulate **what would happen if** a disruption occurred. When a critical port, route, or warehouse fails, operators must react manually — without data-driven recovery strategies, cost estimates, or risk analysis. Billions in cargo value is exposed to avoidable delays.

---

## 💡 Solution

ChainMind AI is a **Supply Chain Digital Twin + What-If Crisis Simulator**. It models a real logistics network (India-focused, 250+ shipments, 48 routes, 8 ports, 95 fleet assets) and allows operators to simulate any disruption scenario:

> "What happens if Mumbai Port is closed for 72 hours at high severity?"

The system dynamically calculates cascading impact, scores risk per shipment, evaluates cold-chain exposure, finds alternative routes using graph algorithms, and recommends the optimal recovery strategy — all from real simulation, not hardcoded results.

---

## ✨ Key Features

- **What-If Crisis Simulator**: Run port closures, weather events, strikes, and more — results are dynamically calculated from the digital twin
- **Cascading Impact Engine**: Identifies directly and indirectly affected shipments through graph traversal
- **Three Recovery Strategies**: Cost-Optimized, Speed-Optimized, and AI-Recommended (Balanced) — all scored with a transparent multi-factor algorithm
- **Cold-Chain Risk Analysis**: Temperature-sensitive shipments (vaccines, pharmaceuticals, fresh produce) tracked with deviation scoring
- **Explainable AI**: Every recommendation includes factor-by-factor explanation; LLM-enhanced if configured, template-based fallback always available
- **What-If Comparison**: Compare up to 5 scenarios side-by-side (e.g., 72h vs 120h closure) with visual charts

---

## 🛠️ Tech Stack

| Category | Technologies |
|---|---|
| **Languages** | Python 3.13, TypeScript |
| **Backend** | FastAPI, SQLAlchemy, NetworkX, scikit-learn |
| **Frontend** | React 19, Vite 8, Recharts, React-Leaflet |
| **Database** | SQLite (dev) / PostgreSQL-ready |
| **ML** | RandomForestRegressor (delay), GradientBoostingClassifier (risk) |
| **IBM Technologies** | IBM Bob (primary development agent throughout) |
| **Other** | Tailwind CSS 3, Lucide Icons, Axios |

---

## 📁 Repository Structure

```
src/
  backend/
    app/
      api/          # FastAPI endpoints
      database/     # SQLAlchemy models + session
      simulation/   # Core simulation engine + risk scorer
      optimization/ # Route optimizer (NetworkX) + fleet optimizer
      ml/           # ML predict + features
      llm/          # LLM explainer (OpenAI/watsonx/template)
      config/       # Settings
    scripts/        # generate_dataset.py, train_models.py
    tests/          # 22 backend tests
    requirements.txt
  frontend/
    src/
      components/   # Dashboard, Simulation, WhatIf, History tabs
      charts/       # Recharts components
      services/     # API client
      utils/        # Format helpers
docs/
demo/
presentation/
submission.yaml
```

---

## ⚡ How to Run

See full instructions in [`docs/setup-guide.md`](docs/setup-guide.md)

```bash
# Backend
cd src/backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
python scripts/generate_dataset.py
python scripts/train_models.py  # optional ML training
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd src/frontend
npm install
npm run dev
```

Open **http://localhost:5173** for the dashboard.
API docs: **http://localhost:8000/api/docs**

---

## 🖥️ Demo

| Artifact | Link |
|---|---|
| 📹 Demo Video | [See demo/demo-video-link.txt](demo/demo-video-link.txt) |
| 🌐 Live Demo | [See demo/live-demo-url.txt](demo/live-demo-url.txt) |
| 🖼️ Screenshots | [See demo/screenshots/](demo/screenshots/) |
| 📊 Presentation | [See presentation/](presentation/) |

---

## 🔑 Environment Variables

```bash
cp src/backend/.env.example src/backend/.env
```

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | SQLite (default) or PostgreSQL URL | No (defaults to SQLite) |
| `LLM_PROVIDER` | `openai`, `watsonx`, or `none` | No |
| `LLM_API_KEY` | OpenAI API key | Only if LLM_PROVIDER=openai |
| `WATSONX_API_KEY` | IBM watsonx API key | Only if LLM_PROVIDER=watsonx |
| `WATSONX_PROJECT_ID` | IBM watsonx project ID | Only if LLM_PROVIDER=watsonx |

---

## 🤖 IBM Bob Usage

IBM Bob was the primary development agent for ChainMind AI:

- **Architecture design**: Designed the simulation pipeline, digital twin schema, and API structure
- **Backend implementation**: Simulation engine, risk scorer, route optimizer, fleet optimizer, LLM explainer
- **Database schema**: SQLAlchemy models for 12 entities
- **Dataset generation**: Synthetic India logistics data generator
- **ML pipeline**: Feature engineering, RandomForest/GradientBoosting training scripts
- **Frontend**: React dashboard, Recharts visualizations, Leaflet map
- **Testing**: 22 backend tests covering all simulation scenarios
- **Documentation**: All docs written with Bob

---

## ⚠️ Known Limitations

- Cold-chain risk uses a simplified hackathon model (not Arrhenius degradation)
- ML models trained on synthetic data — for demonstration purposes only
- Map tiles require internet connection (OpenStreetMap/CartoCDN)
- LLM explanation requires separate API key configuration; falls back to templates
- What-If comparison runs simulations sequentially (not parallel)

---

## 🏅 What We're Most Proud Of

The **end-to-end deterministic simulation pipeline**: from scenario input → digital twin state → cascading impact → risk scoring → route optimization → fleet allocation → strategy scoring → explainable recommendation. Every displayed number is dynamically calculated — no hardcoded results. The 72h vs 120h Mumbai Port comparison visibly demonstrates how the system responds to changed parameters, which is the core "supply-chain time machine" differentiator.
