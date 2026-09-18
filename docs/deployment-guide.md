# ChainMind AI — Production Deployment Guide

> Deploy the Render (FastAPI backend) + Vercel (React frontend) stack.
> Phase 2A preparation is already committed. This guide covers the actual dashboard steps.

---

## Architecture

```
Browser → Vercel (React/Vite SPA)
                ↓  HTTPS API calls to VITE_API_URL
         Render (FastAPI + SQLite + ML models)
```

---

## Prerequisites

- GitHub repository access: `origin/round2`
- [Render](https://render.com) account (free tier is sufficient)
- [Vercel](https://vercel.com) account (free tier is sufficient)

---

## Part 1 — Deploy the Backend on Render

### Step 1 — Connect repository

1. Go to [https://dashboard.render.com](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub account if not already connected
4. Select the repository: `bob-ai-hackathon-chainmind` (or your fork)
5. Select branch: **`round2`**

### Step 2 — Configure the service

Render will detect `render.yaml` at the root. If it does not auto-populate, use these settings:

| Setting | Value |
|---|---|
| **Name** | `chainmind-api` |
| **Runtime** | Python |
| **Root Directory** | `src/backend` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Region** | Oregon (or your nearest) |
| **Instance Type** | Free |

### Step 3 — Set environment variables

In the Render dashboard → **Environment** tab, add:

| Key | Value |
|---|---|
| `DATABASE_URL` | `sqlite:///./chainmind.db` |
| `APP_ENV` | `production` |
| `DEBUG` | `false` |
| `LLM_PROVIDER` | `none` |
| `ML_MODELS_DIR` | `ml_models` |
| `CORS_ORIGINS` | *(leave empty for now — add after Vercel deploy)* |

> `CORS_ORIGINS` will be filled in after you know the Vercel URL (Part 2, Step 5).

### Step 4 — Deploy

Click **Create Web Service**. Render will:
1. Clone the repository
2. Run `pip install -r requirements.txt`
3. Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. On first startup, `_seed_if_empty()` auto-creates and seeds the SQLite database (8 ports, 12 warehouses, 48 routes, 250 shipments, 95 fleet, etc.)
5. Load ML models from `ml_models/` (pre-trained, committed to the repo)

### Step 5 — Verify backend

Once the deploy shows **Live**, check:

```
https://<your-render-service>.onrender.com/api/health
# Expected: {"status": "ok"}

https://<your-render-service>.onrender.com/api/docs
# Expected: Swagger UI
```

Note your Render URL — you will need it in Part 2.

---

## Part 2 — Deploy the Frontend on Vercel

### Step 1 — Connect repository

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Import the GitHub repository: `bob-ai-hackathon-chainmind`
3. Select branch: **`round2`**

### Step 2 — Configure project settings

| Setting | Value |
|---|---|
| **Framework Preset** | Vite |
| **Root Directory** | `src/frontend` |
| **Build Command** | `npm run build` *(auto-detected from vercel.json)* |
| **Output Directory** | `dist` *(auto-detected from vercel.json)* |

### Step 3 — Set environment variable

In **Environment Variables**, add:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://<your-render-service>.onrender.com/api` |

Replace `<your-render-service>` with the actual Render hostname from Part 1, Step 5.

### Step 4 — Deploy

Click **Deploy**. Vercel will:
1. Run `npm install`
2. Run `npm run build` (TypeScript + Vite production build)
3. Serve the `dist/` directory as a static SPA
4. Apply the SPA rewrite (`/*` → `/index.html`) from `vercel.json`

### Step 5 — Update Render CORS_ORIGINS

Once Vercel shows **Ready**, note your Vercel production URL (e.g. `https://chainmind-ai.vercel.app`).

Go back to Render → **Environment** tab → update `CORS_ORIGINS`:

```
CORS_ORIGINS=https://chainmind-ai.vercel.app
```

If Vercel gives you multiple URLs (production + preview), add them comma-separated:

```
CORS_ORIGINS=https://chainmind-ai.vercel.app,https://chainmind-ai-git-round2.vercel.app
```

Render will redeploy automatically after the env var change.

---

## Part 3 — Post-Deployment Verification

Once both are live, verify the following from the **public** Vercel URL:

| Check | Expected |
|---|---|
| Dashboard loads | 250 shipments, 8 ports, fleet summary |
| Map renders | Port markers on India map |
| Simulate Crisis tab | Port / weather / route disruption works |
| Manual Mode | Conditions panel, run simulation |
| Auto Mode | Start/stop monitoring, scenario selector |
| Digital Twin | Network map animates |
| What-If Compare | Side-by-side scenario comparison |
| No CORS errors | Browser console is clean |
| Backend health | `/api/health` returns `{"status": "ok"}` |

---

## Environment Variables Reference

### Backend (Render)

| Variable | Description | Required | Default |
|---|---|---|---|
| `DATABASE_URL` | SQLite path | No | `sqlite:///./chainmind.db` |
| `APP_ENV` | `production` | No | `development` |
| `DEBUG` | `false` | No | `false` |
| `LLM_PROVIDER` | `none` / `openai` / `watsonx` | No | `none` |
| `ML_MODELS_DIR` | Path to `.joblib` files | No | `ml_models` |
| `CORS_ORIGINS` | Comma-separated allowed origins | **Yes (production)** | *(localhost only)* |

### Frontend (Vercel)

| Variable | Description | Required |
|---|---|---|
| `VITE_API_URL` | Full URL of the Render API, ending in `/api` | **Yes** |

---

## Live URLs

| Service | URL |
|---|---|
| **Frontend (Vercel)** | *(set after deployment)* |
| **Backend API (Render)** | *(set after deployment)* |
| **API Docs (Swagger)** | `<backend-url>/api/docs` |
| **Health Check** | `<backend-url>/api/health` |

---

## Notes

- The SQLite database is ephemeral on Render's free tier (disk resets on redeploy). The auto-seed on startup means data is always available after every deploy.
- ML models (`delay_model.joblib`, `risk_model.joblib`) are committed to the repository and loaded at startup. If loading fails, the app falls back to deterministic scoring — all features still work.
- LLM explanations are disabled by default (`LLM_PROVIDER=none`). Template-based explanations are always available.
- Render free tier services spin down after 15 minutes of inactivity. The first request after spin-down takes ~30s (cold start + database seed).
