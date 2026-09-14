from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models import Route

router = APIRouter()


@router.get("/routes")
async def get_routes(
    origin: str = Query(None),
    destination: str = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
):
    """Get routes, optionally filtered."""
    query = db.query(Route)
    if active_only:
        query = query.filter(Route.is_active == True)
    if origin:
        query = query.filter(Route.origin.ilike(f"%{origin}%"))
    if destination:
        query = query.filter(Route.destination.ilike(f"%{destination}%"))

    routes = query.all()
    return [
        {
            "route_id": r.route_id,
            "name": r.name,
            "origin": r.origin,
            "destination": r.destination,
            "distance_km": r.distance_km,
            "normal_time_hours": r.normal_time_hours,
            "transport_mode": r.transport_mode,
            "congestion": r.congestion,
            "risk_score": r.risk_score,
            "cost_per_km": r.cost_per_km,
            "is_active": r.is_active,
            "origin_port_id": r.origin_port_id,
            "dest_port_id": r.dest_port_id,
        }
        for r in routes
    ]
