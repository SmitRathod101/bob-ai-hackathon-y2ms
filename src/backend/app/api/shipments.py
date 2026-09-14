from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database.session import get_db
from app.database.models import Shipment

router = APIRouter()


@router.get("/shipments")
async def get_shipments(
    status: Optional[str] = Query(None),
    priority: Optional[int] = Query(None),
    temperature_sensitive: Optional[bool] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    """Get shipments with optional filters."""
    query = db.query(Shipment)
    if status:
        query = query.filter(Shipment.status == status)
    if priority is not None:
        query = query.filter(Shipment.priority == priority)
    if temperature_sensitive is not None:
        query = query.filter(Shipment.temperature_sensitive == temperature_sensitive)

    total = query.count()
    shipments = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "shipments": [
            {
                "shipment_id": s.shipment_id,
                "origin": s.origin,
                "destination": s.destination,
                "current_location": s.current_location,
                "route_id": s.route_id,
                "port_id": s.port_id,
                "carrier": s.carrier,
                "cargo_type": s.cargo_type,
                "cargo_value": s.cargo_value,
                "weight_kg": s.weight_kg,
                "priority": s.priority,
                "temperature_sensitive": s.temperature_sensitive,
                "required_temp_min": s.required_temp_min,
                "required_temp_max": s.required_temp_max,
                "current_temperature": s.current_temperature,
                "departure_time": s.departure_time.isoformat() if s.departure_time else None,
                "expected_arrival": s.expected_arrival.isoformat() if s.expected_arrival else None,
                "status": s.status,
                "estimated_delay_hours": s.estimated_delay_hours,
                "risk_score": s.risk_score,
                "progress_pct": s.progress_pct,
            }
            for s in shipments
        ],
    }
