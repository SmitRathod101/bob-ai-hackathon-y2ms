from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models import Shipment, Port, SimulationRun
from app.optimization.fleet_optimizer import get_fleet_summary

router = APIRouter()


@router.get("/dashboard/summary")
async def get_dashboard_summary(db: Session = Depends(get_db)):
    """Get high-level dashboard KPIs for the current supply-chain state."""
    all_shipments = db.query(Shipment).all()
    total = len(all_shipments)

    status_counts = {}
    for s in all_shipments:
        status_counts[s.status] = status_counts.get(s.status, 0) + 1

    total_cargo_value = sum(s.cargo_value or 0 for s in all_shipments)
    cold_chain = sum(1 for s in all_shipments if s.temperature_sensitive)
    high_priority = sum(1 for s in all_shipments if s.priority in (1, 2))

    fleet_sum = get_fleet_summary(db)

    ports = db.query(Port).all()
    port_list = [
        {
            "port_id": p.port_id,
            "name": p.name,
            "city": p.city,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "congestion": p.congestion,
            "operational_status": p.operational_status,
            "capacity": p.capacity,
        }
        for p in ports
    ]

    recent_sims = (
        db.query(SimulationRun)
        .order_by(SimulationRun.created_at.desc())
        .limit(5)
        .all()
    )
    sim_list = [
        {
            "simulation_id": s.simulation_id,
            "scenario_name": s.scenario_name,
            "disruption_type": s.disruption_type,
            "location": s.location,
            "duration_hours": s.duration_hours,
            "severity": s.severity,
            "total_affected_shipments": s.total_affected_shipments,
            "total_cargo_value_exposed": s.total_cargo_value_exposed,
            "average_delay_hours": s.average_delay_hours,
            "recommended_strategy": s.recommended_strategy,
            "status": s.status,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in recent_sims
    ]

    return {
        "total_shipments": total,
        "in_transit": status_counts.get("in_transit", 0),
        "delayed": status_counts.get("delayed", 0),
        "at_port": status_counts.get("at_port", 0),
        "at_warehouse": status_counts.get("at_warehouse", 0),
        "delivered": status_counts.get("delivered", 0),
        "total_cargo_value": total_cargo_value,
        "cold_chain_shipments": cold_chain,
        "high_priority_shipments": high_priority,
        "fleet_summary": fleet_sum,
        "ports": port_list,
        "recent_simulations": sim_list,
    }
