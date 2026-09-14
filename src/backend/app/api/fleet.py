from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models import Fleet
from app.optimization.fleet_optimizer import get_fleet_summary

router = APIRouter()


@router.get("/fleet")
async def get_fleet(db: Session = Depends(get_db)):
    """Get all fleet assets and summary."""
    fleet = db.query(Fleet).all()
    summary = get_fleet_summary(db)
    return {
        "summary": summary,
        "vehicles": [
            {
                "vehicle_id": v.vehicle_id,
                "vehicle_type": v.vehicle_type,
                "name": v.name,
                "carrier": v.carrier,
                "capacity_kg": v.capacity_kg,
                "capacity_m3": v.capacity_m3,
                "current_location": v.current_location,
                "latitude": v.latitude,
                "longitude": v.longitude,
                "availability": v.availability,
                "utilization": v.utilization,
                "is_refrigerated": v.is_refrigerated,
                "min_temp": v.min_temp,
                "max_temp": v.max_temp,
                "operating_cost_per_km": v.operating_cost_per_km,
                "speed_kmh": v.speed_kmh,
            }
            for v in fleet
        ],
    }
