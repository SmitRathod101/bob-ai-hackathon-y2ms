# ChainMind AI — Local Setup Guide

> **ChainMind AI is not deployed.** Judges run it locally by following this guide.
> Demo video: [https://youtu.be/yNumP-njqTQ](https://youtu.be/yNumP-njqTQ)

---

## A. Prerequisites

Before you begin, ensure you have the following installed:

| Tool | Required version |
|---|---|
| Python | 3.11 or newer (tested with 3.13) |
| Node.js + npm | 18 or newer |
| Git | any recent version |

---

## B. Backend Setup

### 1. Navigate to the backend directory

```bash
cd src/backend
```

### 2. Create and activate a virtual environment

```bash
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

```bash
cp .env.example .env
# All defaults work for local development — no edits required.
```

Key variables (all have safe defaults):

| Variable | Description | Required | Default |
|---|---|---|---|
| `DATABASE_URL` | Database connection string | No | `sqlite:///./chainmind.db` |
| `LLM_PROVIDER` | `openai`, `watsonx`, or `none` | No | `none` |
| `LLM_API_KEY` | OpenAI API key | Only if `openai` | — |
| `WATSONX_API_KEY` | IBM watsonx API key | Only if `watsonx` | — |
| `WATSONX_PROJECT_ID` | watsonx project ID | Only if `watsonx` | — |
| `WATSONX_URL` | watsonx endpoint URL | No | `https://us-south.ml.cloud.ibm.com` |

> The application works fully without any LLM key. Template-based explanations are used as a fallback.

### 5. Generate the dataset and initialize the database

```bash
# From src/backend (with venv active)
python scripts/generate_dataset.py
```

Expected output:
```
[OK] Dataset generation complete!
   Ports:         8
   Warehouses:    12
   Routes:        48
   Shipments:     250
   Fleet assets:  95
   Weather events:2
   IoT readings:  500
```

This creates `src/backend/chainmind.db` (SQLite).

### 6. ML Model Training (Optional)

Pre-trained model files are already included in `src/backend/ml_models/`. You do **not** need to retrain them. If you want to retrain:

```bash
python scripts/train_models.py
# Delay Model - MAE: ~1.7 hours
# Risk Model  - Accuracy: ~0.99
# Models saved to: ml_models/
```

> The application falls back to deterministic scoring if models are missing.

### 7. Start the backend server

```bash
# From src/backend (with venv active)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 8. Verify the backend is running

Open **http://localhost:8000/api/health** in your browser, or:

```bash
curl http://localhost:8000/api/health
```

Expected response:
```json
{"status": "ok"}
```

You can also browse the full interactive API at **http://localhost:8000/api/docs**.

---

## C. Frontend Setup

Open a **new terminal** (keep the backend running).

### 1. Navigate to the frontend directory

```bash
cd src/frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables (optional for local dev)

The frontend ships with a `.env.example`:

```bash
cp .env.example .env
# VITE_API_URL=http://localhost:8000/api  ← already the correct default
```

> For local development you do **not** need to create `.env` at all — see the next section.

### 4. Start the frontend dev server

```bash
npm run dev
```

The dashboard is available at: **http://localhost:5173**

### 5. Verify the frontend is working

Open **http://localhost:5173**. You should see the ChainMind AI dashboard with:
- 250 active shipments loaded
- 8 ports shown on the map
- Fleet status panel populated

If the dashboard loads but shows no data, confirm the backend is running on port 8000.

---

## D. How the Frontend Connects to the Backend

In local development the frontend **does not** make direct cross-origin requests to port 8000. Instead, Vite's built-in dev-server proxy (configured in `src/frontend/vite.config.ts`) forwards any request matching `/api/*` from `localhost:5173` to `localhost:8000`:

```
Browser → http://localhost:5173/api/...
         ↓  (Vite proxy — same origin, no CORS issue)
Backend → http://localhost:8000/api/...
```

This means:
- No browser CORS error occurs.
- No `.env` file or `VITE_API_URL` change is needed for local development.
- As long as the backend is running on port 8000 before you start `npm run dev`, everything connects automatically.

---

## E. Running Tests

```bash
# From src/backend (with venv active)
python -m pytest tests/ -v
# Expected: 22 passed
```

---

## F. Local Demo Workflow

### Mumbai Port 72-hour scenario

1. Open **http://localhost:5173**
2. The **Dashboard** tab shows 250 active shipments, 8 ports, fleet status
3. Click the **"Simulate Crisis"** tab
4. Select: **Port Closure** → **Mumbai Port** → **72 hours** → **High Severity**
5. Click **"Run Crisis Simulation"**
6. Review the impact: ~78 affected shipments, ~₹33 Cr exposed, ~245h avg delay
7. See the three recovery strategies (Cost-Optimized, Speed-Optimized, AI-Recommended) with costs and risk levels
8. Read the Explainable AI recommendation and action plan

### Mumbai Port 120-hour scenario

9. Click the **"Mumbai 120h"** preset (or manually set duration to 120 hours)
10. Click **"Run Crisis Simulation"** again
11. Compare results: delay increases to ~409h, cargo exposure rises
12. Both scenarios are now in history

### What-If Comparison

13. Go to the **"What-If Compare"** tab
14. Select the 72h and 120h runs side-by-side
15. The charts show how the system responds to the longer disruption duration

---

## G. Troubleshooting

| Issue | Solution |
|---|---|
| `ModuleNotFoundError` | Activate the venv first: `.venv\Scripts\activate` (Windows) or `source .venv/bin/activate` (macOS/Linux), then `pip install -r requirements.txt` |
| `chainmind.db not found` | Run `python scripts/generate_dataset.py` from `src/backend` |
| Frontend shows no data / "cannot connect" | Ensure backend is running on port 8000 before starting `npm run dev` |
| CORS error in browser console | Confirm `CORS_ORIGINS` in `src/backend/.env` includes `http://localhost:5173` (it does by default) |
| Map tiles not loading | Requires an internet connection for CartoCDN tiles |
| `sklearn not installed` | Run `pip install scikit-learn==1.5.2` inside the active venv |
| Backend starts but dataset is empty | Re-run `python scripts/generate_dataset.py` — it is safe to run multiple times |
