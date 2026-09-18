"""
ChainMind AI — FastAPI Main Application

Entry point for the backend API server.
"""

import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.database.session import init_db
from app.ml.predict import load_models
from app.api import health, dashboard, ports, warehouses, routes, shipments, fleet, simulate, scenarios, manual, auto

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("🚀 ChainMind AI starting up...")
    init_db()
    load_models()
    logger.info("✅ Database initialized and ML models loaded")
    yield
    logger.info("👋 ChainMind AI shutting down")


app = FastAPI(
    title="ChainMind AI",
    description="AI-Powered Supply Chain Crisis Simulator — What-If Disruption Analysis",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(ports.router, prefix="/api", tags=["Ports"])
app.include_router(warehouses.router, prefix="/api", tags=["Warehouses"])
app.include_router(routes.router, prefix="/api", tags=["Routes"])
app.include_router(shipments.router, prefix="/api", tags=["Shipments"])
app.include_router(fleet.router, prefix="/api", tags=["Fleet"])
app.include_router(simulate.router, prefix="/api", tags=["Simulation"])
app.include_router(scenarios.router, prefix="/api", tags=["Scenarios"])
app.include_router(manual.router, prefix="/api", tags=["Manual Mode"])
app.include_router(auto.router, prefix="/api", tags=["Auto Mode"])


@app.get("/", include_in_schema=False)
async def root():
    return {"message": "ChainMind AI — Supply Chain Crisis Simulator", "docs": "/api/docs"}
