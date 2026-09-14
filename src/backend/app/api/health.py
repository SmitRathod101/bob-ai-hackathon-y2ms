from fastapi import APIRouter
from app.ml.predict import get_model_status

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    ml_status = get_model_status()
    return {
        "status": "healthy",
        "service": "ChainMind AI",
        "version": "1.0.0",
        "ml_models": ml_status,
    }
