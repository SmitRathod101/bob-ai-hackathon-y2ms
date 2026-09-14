"""
Fleet Optimization Service

Identifies available fleet assets for recovery operations.
Considers:
- Proximity to affected areas
- Vehicle availability
- Refrigeration capability for cold-chain
- Capacity requirements
- Estimated repositioning time and cost
"""

from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from app.database.models import Fleet
import math


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two lat/lon points in km."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(d_lon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# Approximate coordinates for major logistics nodes
NODE_COORDS = {
    "Mumbai":         (19.0760, 72.8777),
    "JNPT":           (18.9507, 72.9492),
    "Pune":           (18.5204, 73.8567),
    "Ahmedabad":      (23.0225, 72.5714),
    "Delhi":          (28.6139, 77.2090),
    "Bengaluru":      (12.9716, 77.5946),
    "Hyderabad":      (17.3850, 78.4867),
    "Chennai":        (13.0827, 80.2707),
    "Kolkata":        (22.5726, 88.3639),
    "Mundra":         (22.8390, 69.7218),
    "Kandla":         (23.0333, 70.2167),
    "Nagpur":         (21.1458, 79.0882),
    "Surat":          (21.1702, 72.8311),
    "Jaipur":         (26.9124, 75.7873),
    "Lucknow":        (26.8467, 80.9462),
    "Kochi":          (9.9312,  76.2673),
    "Visakhapatnam":  (17.6868, 83.2185),
}

# Maximum radius to search for available fleet (km)
DEFAULT_SEARCH_RADIUS_KM = 800.0


def find_available_fleet(
    db: Session,
    disruption_location: str,
    require_refrigerated: bool = False,
    max_radius_km: float = DEFAULT_SEARCH_RADIUS_KM,
    min_capacity_kg: float = 0.0,
    top_n: int = 20,
) -> List[Dict]:
    """
    Find available fleet assets near a disruption location.
    Returns a list of fleet asset dicts sorted by distance + cost score.
    """
    if disruption_location in NODE_COORDS:
        disrupt_lat, disrupt_lon = NODE_COORDS[disruption_location]
    else:
        # Fall back to central India if location unknown
        disrupt_lat, disrupt_lon = 20.5937, 78.9629

    query = db.query(Fleet).filter(Fleet.availability == True)
    if require_refrigerated:
        query = query.filter(Fleet.is_refrigerated == True)
    if min_capacity_kg > 0:
        query = query.filter(Fleet.capacity_kg >= min_capacity_kg)

    all_available = query.all()

    results = []
    for vehicle in all_available:
        v_lat = vehicle.latitude or 20.5
        v_lon = vehicle.longitude or 79.0
        dist = haversine_km(disrupt_lat, disrupt_lon, v_lat, v_lon)

        if dist > max_radius_km:
            continue

        # Estimated repositioning time = dist / speed
        speed = vehicle.speed_kmh or 60.0
        reposition_hours = dist / speed

        # Estimated repositioning cost
        reposition_cost = dist * vehicle.operating_cost_per_km

        # Simple score: normalize distance + cost + utilization (lower = better)
        score = (dist / max_radius_km) * 0.5 + vehicle.utilization * 0.3 + (reposition_cost / 100000) * 0.2

        results.append({
            "vehicle_id": vehicle.vehicle_id,
            "vehicle_type": vehicle.vehicle_type,
            "carrier": vehicle.carrier,
            "current_location": vehicle.current_location,
            "capacity_kg": vehicle.capacity_kg,
            "capacity_m3": vehicle.capacity_m3,
            "is_refrigerated": vehicle.is_refrigerated,
            "min_temp": vehicle.min_temp,
            "max_temp": vehicle.max_temp,
            "utilization": vehicle.utilization,
            "distance_km": round(dist, 1),
            "reposition_hours": round(reposition_hours, 1),
            "reposition_cost_inr": round(reposition_cost, 2),
            "operating_cost_per_km": vehicle.operating_cost_per_km,
            "speed_kmh": vehicle.speed_kmh,
            "score": round(score, 4),
        })

    results.sort(key=lambda x: x["score"])
    return results[:top_n]


def calculate_fleet_requirements(
    affected_shipment_count: int,
    avg_cargo_weight_kg: float,
    cold_chain_count: int,
    avg_vehicle_capacity_kg: float = 15000.0,
) -> Dict:
    """Estimate how many additional vehicles are needed for recovery."""
    # Standard vehicles needed
    total_weight = affected_shipment_count * avg_cargo_weight_kg
    standard_vehicles = math.ceil(total_weight / avg_vehicle_capacity_kg)

    # Refrigerated vehicles needed
    refrig_vehicles = math.ceil(cold_chain_count * 1.2)  # 20% buffer

    return {
        "standard_vehicles_needed": standard_vehicles,
        "refrigerated_vehicles_needed": refrig_vehicles,
        "total_vehicles_needed": standard_vehicles + refrig_vehicles,
        "estimated_total_weight_kg": round(total_weight, 1),
    }


def get_fleet_summary(db: Session) -> Dict:
    """Get high-level fleet utilization summary."""
    all_fleet = db.query(Fleet).all()
    total = len(all_fleet)
    available = sum(1 for v in all_fleet if v.availability)
    refrigerated = sum(1 for v in all_fleet if v.is_refrigerated)
    refrig_available = sum(1 for v in all_fleet if v.is_refrigerated and v.availability)
    avg_util = sum(v.utilization for v in all_fleet) / total if total > 0 else 0

    return {
        "total_vehicles": total,
        "available_vehicles": available,
        "utilized_vehicles": total - available,
        "refrigerated_vehicles": refrigerated,
        "refrigerated_available": refrig_available,
        "average_utilization": round(avg_util, 3),
        "utilization_pct": round(avg_util * 100, 1),
    }
