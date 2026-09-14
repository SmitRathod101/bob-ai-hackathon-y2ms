from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models import Warehouse

router = APIRouter()


@router.get("/warehouses")
async def get_warehouses(db: Session = Depends(get_db)):
    """Get all warehouses."""
    warehouses = db.query(Warehouse).all()
    return [
        {
            "warehouse_id": w.warehouse_id,
            "name": w.name,
            "city": w.city,
            "state": w.state,
            "latitude": w.latitude,
            "longitude": w.longitude,
            "capacity": w.capacity,
            "current_utilization": w.current_utilization,
            "has_cold_storage": w.has_cold_storage,
            "cold_storage_capacity": w.cold_storage_capacity,
            "operational_status": w.operational_status,
        }
        for w in warehouses
    ]
