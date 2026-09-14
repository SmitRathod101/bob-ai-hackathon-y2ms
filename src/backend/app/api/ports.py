from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.session import get_db
from app.database.models import Port

router = APIRouter()


@router.get("/ports")
async def get_ports(db: Session = Depends(get_db)):
    """Get all ports with their current status."""
    ports = db.query(Port).all()
    return [
        {
            "port_id": p.port_id,
            "name": p.name,
            "city": p.city,
            "state": p.state,
            "country": p.country,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "capacity": p.capacity,
            "current_load": p.current_load,
            "congestion": p.congestion,
            "operational_status": p.operational_status,
            "annual_throughput": p.annual_throughput,
        }
        for p in ports
    ]


@router.get("/ports/{port_id}")
async def get_port(port_id: str, db: Session = Depends(get_db)):
    """Get a single port by ID."""
    port = db.query(Port).filter(Port.port_id == port_id).first()
    if not port:
        raise HTTPException(status_code=404, detail=f"Port {port_id} not found")
    return port
