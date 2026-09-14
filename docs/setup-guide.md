# Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- [x] Python 3.11+ (tested with Python 3.13)
- [x] Node.js 18+ and npm
- [x] Git

## Environment Variables

```bash
cd src/backend
cp .env.example .env
# Edit .env if needed (all defaults work for local dev)
```

| Variable | Description | Required | Default |
|---|---|---|---|
| `DATABASE_URL` | Database connection string | No | `sqlite:///./chainmind.db` |
| `LLM_PROVIDER` | `openai`, `watsonx`, or `none` | No | `none` |
| `LLM_API_KEY` | OpenAI API key | Only if `openai` | — |
| `WATSONX_API_KEY` | IBM watsonx API key | Only if `watsonx` | — |
| `WATSONX_PROJECT_ID` | watsonx project ID | Only if `watsonx` | — |
| `WATSONX_URL` | watsonx endpoint URL | No | `https://us-south.ml.cloud.ibm.com` |

> The application works fully without any LLM key. Template-based explanations are used as fallback.

## Backend Installation

```bash
# 1. Navigate to backend directory
cd src/backend

# 2. Create virtual environment
python -m venv .venv

# 3. Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt
```

## Database Setup & Data Generation

```bash
# From src/backend directory (with venv active)

# Generate the synthetic dataset (creates chainmind.db)
python scripts/generate_dataset.py

# Expected output:
# [OK] Dataset generation complete!
#    Ports:         8
#    Warehouses:    12
#    Routes:        48
#    Shipments:     250
#    Fleet assets:  95
#    Weather events:2
#    IoT readings:  500
```

## ML Model Training (Optional)

```bash
# Train delay prediction and risk classification models
python scripts/train_models.py

# Expected output:
#   Delay Model - MAE: ~1.7 hours  (synthetic data baseline)
#   Risk Model - Accuracy: ~0.99  (synthetic data baseline)
# Models saved to: ml_models/
```

> The application works without trained models — deterministic fallback is always used if models are unavailable.

## Running the Backend

```bash
# From src/backend directory (with venv active)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API Base**: `http://localhost:8000/api`
- **API Docs (Swagger)**: `http://localhost:8000/api/docs`
- **Health Check**: `http://localhost:8000/api/health`

## Frontend Installation & Running

```bash
# In a new terminal
cd src/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at: **http://localhost:5173**

## Running Tests

```bash
# From src/backend directory (with venv active)
python -m pytest tests/ -v

# Expected: 22 passed
```

## Quick Demo Flow

1. Open `http://localhost:5173`
2. The Dashboard shows 250 active shipments, 8 ports, fleet status
3. Click **"Simulate Crisis"** tab
4. Select: Port Closure → Mumbai Port → 72 hours → High Severity
5. Click **"Run Crisis Simulation"**
6. View impact: ~78 affected shipments, ~₹33 Cr exposed, ~245h avg delay
7. See three recovery strategies with costs and risk levels
8. View AI explanation and action plan
9. Click **"Mumbai 120h"** preset to change duration
10. Run again — results change (delay increases to ~409h)
11. Go to **"What-If Compare"** to compare both scenarios side-by-side

## Troubleshooting

| Issue | Solution |
|---|---|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` inside the `.venv` |
| `chainmind.db not found` | Run `python scripts/generate_dataset.py` first |
| Frontend can't connect to backend | Ensure backend is running on port 8000; check CORS settings in `.env` |
| Map tiles not loading | Requires internet connection for CartoCDN tiles |
| `sklearn not installed` | Run `pip install scikit-learn==1.5.2` separately |

## Deployment

### Backend (Render / Railway / Fly.io)

1. Set environment variable `DATABASE_URL` to a PostgreSQL connection string
2. Run `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Run `python scripts/generate_dataset.py` as a one-time init command

### Frontend (Vercel / Netlify)

1. Set `VITE_API_URL` to your deployed backend URL
2. Run `npm run build` — deploy the `dist/` directory
