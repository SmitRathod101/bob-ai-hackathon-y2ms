"""
ChainMind AI — Synthetic Dataset Generator

Creates realistic India-focused supply chain data representing:
- Major Indian ports
- Key logistics warehouses/hubs
- Routes between nodes
- Shipments (including cold-chain)
- Fleet assets
- Weather events
- IoT readings

Run: python scripts/generate_dataset.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import random
import json
import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.database.session import engine, init_db, SessionLocal
from app.database.models import (
    Port, Warehouse, Route, Shipment, Fleet,
    WeatherEvent, IotReading, Disruption
)

random.seed(42)

# ── Ports ─────────────────────────────────────────────────────────────────────
PORTS_DATA = [
    {
        "port_id": "PORT_MUM",
        "name": "Mumbai Port",
        "city": "Mumbai",
        "state": "Maharashtra",
        "latitude": 18.9220,
        "longitude": 72.8347,
        "capacity": 8000,
        "annual_throughput": 2400000,
        "congestion": 0.65,
    },
    {
        "port_id": "PORT_JNPT",
        "name": "Jawaharlal Nehru Port (JNPT)",
        "city": "Navi Mumbai",
        "state": "Maharashtra",
        "latitude": 18.9507,
        "longitude": 72.9492,
        "capacity": 12000,
        "annual_throughput": 5900000,
        "congestion": 0.70,
    },
    {
        "port_id": "PORT_MUN",
        "name": "Mundra Port",
        "city": "Mundra",
        "state": "Gujarat",
        "latitude": 22.8390,
        "longitude": 69.7218,
        "capacity": 15000,
        "annual_throughput": 7100000,
        "congestion": 0.55,
    },
    {
        "port_id": "PORT_CHN",
        "name": "Chennai Port",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "latitude": 13.0836,
        "longitude": 80.2928,
        "capacity": 7500,
        "annual_throughput": 2200000,
        "congestion": 0.60,
    },
    {
        "port_id": "PORT_KOL",
        "name": "Kolkata Port",
        "city": "Kolkata",
        "state": "West Bengal",
        "latitude": 22.5726,
        "longitude": 88.3639,
        "capacity": 5000,
        "annual_throughput": 1400000,
        "congestion": 0.50,
    },
    {
        "port_id": "PORT_KOC",
        "name": "Kochi Port",
        "city": "Kochi",
        "state": "Kerala",
        "latitude": 9.9312,
        "longitude": 76.2673,
        "capacity": 4500,
        "annual_throughput": 1100000,
        "congestion": 0.40,
    },
    {
        "port_id": "PORT_VIZ",
        "name": "Visakhapatnam Port",
        "city": "Visakhapatnam",
        "state": "Andhra Pradesh",
        "latitude": 17.6868,
        "longitude": 83.2185,
        "capacity": 6000,
        "annual_throughput": 1800000,
        "congestion": 0.45,
    },
    {
        "port_id": "PORT_KAN",
        "name": "Kandla Port",
        "city": "Kandla",
        "state": "Gujarat",
        "latitude": 23.0333,
        "longitude": 70.2167,
        "capacity": 9000,
        "annual_throughput": 3000000,
        "congestion": 0.58,
    },
]

# ── Warehouses ────────────────────────────────────────────────────────────────
WAREHOUSES_DATA = [
    {"warehouse_id": "WH_MUM", "name": "Mumbai Logistics Hub", "city": "Mumbai", "state": "Maharashtra", "latitude": 19.0760, "longitude": 72.8777, "capacity": 50000, "current_utilization": 0.78, "has_cold_storage": True, "cold_storage_capacity": 8000},
    {"warehouse_id": "WH_PUNE", "name": "Pune Distribution Center", "city": "Pune", "state": "Maharashtra", "latitude": 18.5204, "longitude": 73.8567, "capacity": 35000, "current_utilization": 0.65, "has_cold_storage": True, "cold_storage_capacity": 5000},
    {"warehouse_id": "WH_AHM", "name": "Ahmedabad Freight Terminal", "city": "Ahmedabad", "state": "Gujarat", "latitude": 23.0225, "longitude": 72.5714, "capacity": 40000, "current_utilization": 0.72, "has_cold_storage": True, "cold_storage_capacity": 6000},
    {"warehouse_id": "WH_DEL", "name": "Delhi NCR Mega Hub", "city": "Delhi", "state": "Delhi", "latitude": 28.6139, "longitude": 77.2090, "capacity": 70000, "current_utilization": 0.80, "has_cold_storage": True, "cold_storage_capacity": 12000},
    {"warehouse_id": "WH_BLR", "name": "Bengaluru Tech Corridor Hub", "city": "Bengaluru", "state": "Karnataka", "latitude": 12.9716, "longitude": 77.5946, "capacity": 45000, "current_utilization": 0.68, "has_cold_storage": True, "cold_storage_capacity": 7000},
    {"warehouse_id": "WH_HYD", "name": "Hyderabad Central Warehouse", "city": "Hyderabad", "state": "Telangana", "latitude": 17.3850, "longitude": 78.4867, "capacity": 38000, "current_utilization": 0.61, "has_cold_storage": False, "cold_storage_capacity": 0},
    {"warehouse_id": "WH_CHN", "name": "Chennai Auto Corridor Hub", "city": "Chennai", "state": "Tamil Nadu", "latitude": 13.0827, "longitude": 80.2707, "capacity": 42000, "current_utilization": 0.71, "has_cold_storage": True, "cold_storage_capacity": 5500},
    {"warehouse_id": "WH_KOL", "name": "Kolkata Eastern Gateway", "city": "Kolkata", "state": "West Bengal", "latitude": 22.5726, "longitude": 88.3639, "capacity": 30000, "current_utilization": 0.58, "has_cold_storage": False, "cold_storage_capacity": 0},
    {"warehouse_id": "WH_JAI", "name": "Jaipur Rajasthan Hub", "city": "Jaipur", "state": "Rajasthan", "latitude": 26.9124, "longitude": 75.7873, "capacity": 25000, "current_utilization": 0.55, "has_cold_storage": False, "cold_storage_capacity": 0},
    {"warehouse_id": "WH_LKH", "name": "Lucknow UP Distribution", "city": "Lucknow", "state": "Uttar Pradesh", "latitude": 26.8467, "longitude": 80.9462, "capacity": 28000, "current_utilization": 0.60, "has_cold_storage": False, "cold_storage_capacity": 0},
    {"warehouse_id": "WH_SUR", "name": "Surat Textile Hub", "city": "Surat", "state": "Gujarat", "latitude": 21.1702, "longitude": 72.8311, "capacity": 32000, "current_utilization": 0.75, "has_cold_storage": False, "cold_storage_capacity": 0},
    {"warehouse_id": "WH_NAG", "name": "Nagpur Central India Hub", "city": "Nagpur", "state": "Maharashtra", "latitude": 21.1458, "longitude": 79.0882, "capacity": 22000, "current_utilization": 0.50, "has_cold_storage": False, "cold_storage_capacity": 0},
]

# ── Routes ────────────────────────────────────────────────────────────────────
# (origin, destination, distance_km, normal_time_hours, mode, congestion, risk, cost_per_km, origin_port_id, dest_port_id, alt_for)
ROUTES_TEMPLATE = [
    # Mumbai hub routes
    ("Mumbai", "Pune",         148,  3.0,  "truck", 0.55, 0.20, 12,  "PORT_MUM",  None,         None),
    ("Mumbai", "Ahmedabad",    524,  9.0,  "truck", 0.50, 0.15, 11,  "PORT_MUM",  None,         None),
    ("Mumbai", "Delhi",        1418, 22.0, "truck", 0.70, 0.30, 13,  "PORT_MUM",  None,         None),
    ("Mumbai", "Bengaluru",    981,  16.0, "truck", 0.60, 0.25, 12,  "PORT_MUM",  None,         None),
    ("Mumbai", "Hyderabad",    705,  12.0, "truck", 0.55, 0.20, 11,  "PORT_MUM",  None,         None),
    ("Mumbai", "Nagpur",       835,  14.0, "truck", 0.45, 0.20, 10,  "PORT_MUM",  None,         None),
    ("Mumbai", "Surat",        285,  5.0,  "truck", 0.50, 0.15, 11,  "PORT_MUM",  None,         None),
    # JNPT routes
    ("JNPT",   "Mumbai",       35,   1.0,  "truck", 0.75, 0.20, 12,  "PORT_JNPT", "PORT_MUM",   None),
    ("JNPT",   "Pune",         150,  3.0,  "truck", 0.55, 0.20, 12,  "PORT_JNPT", None,         None),
    ("JNPT",   "Ahmedabad",    530,  9.0,  "truck", 0.50, 0.15, 11,  "PORT_JNPT", None,         None),
    ("JNPT",   "Delhi",        1425, 23.0, "truck", 0.70, 0.30, 13,  "PORT_JNPT", None,         None),
    # Mundra routes
    ("Mundra", "Ahmedabad",    344,  6.0,  "truck", 0.40, 0.15, 10,  "PORT_MUN",  None,         None),
    ("Mundra", "Delhi",        1012, 17.0, "truck", 0.45, 0.20, 11,  "PORT_MUN",  None,         None),
    ("Mundra", "Mumbai",       570,  10.0, "truck", 0.50, 0.20, 11,  "PORT_MUN",  "PORT_MUM",   None),
    ("Mundra", "Surat",        265,  4.5,  "truck", 0.40, 0.15, 10,  "PORT_MUN",  None,         None),
    # Chennai routes
    ("Chennai", "Bengaluru",   346,  6.0,  "truck", 0.65, 0.25, 12,  "PORT_CHN",  None,         None),
    ("Chennai", "Hyderabad",   628,  10.5, "truck", 0.55, 0.20, 11,  "PORT_CHN",  None,         None),
    ("Chennai", "Kochi",       682,  11.5, "truck", 0.45, 0.20, 11,  "PORT_CHN",  "PORT_KOC",   None),
    ("Chennai", "Visakhapatnam", 794, 13.0, "truck", 0.50, 0.25, 11, "PORT_CHN",  "PORT_VIZ",   None),
    # Kolkata routes
    ("Kolkata", "Delhi",       1472, 24.0, "truck", 0.60, 0.30, 12,  "PORT_KOL",  None,         None),
    ("Kolkata", "Hyderabad",   1502, 25.0, "truck", 0.50, 0.25, 11,  "PORT_KOL",  None,         None),
    ("Kolkata", "Visakhapatnam", 905, 15.0,"truck", 0.45, 0.20, 10,  "PORT_KOL",  "PORT_VIZ",   None),
    # Internal routes
    ("Delhi",   "Jaipur",      269,  5.0,  "truck", 0.60, 0.20, 12,  None,        None,         None),
    ("Delhi",   "Lucknow",     556,  9.0,  "truck", 0.55, 0.20, 11,  None,        None,         None),
    ("Delhi",   "Ahmedabad",   944,  16.0, "truck", 0.50, 0.20, 11,  None,        None,         None),
    ("Ahmedabad", "Delhi",     944,  16.0, "truck", 0.50, 0.20, 11,  None,        None,         None),
    ("Ahmedabad", "Mumbai",    524,  9.0,  "truck", 0.50, 0.15, 11,  None,        "PORT_MUM",   None),
    ("Ahmedabad", "Surat",     260,  4.5,  "truck", 0.45, 0.15, 10,  None,        None,         None),
    ("Bengaluru", "Hyderabad", 575,  9.5,  "truck", 0.55, 0.20, 11,  None,        None,         None),
    ("Bengaluru", "Chennai",   346,  6.0,  "truck", 0.65, 0.25, 12,  None,        "PORT_CHN",   None),
    ("Hyderabad", "Nagpur",    499,  8.5,  "truck", 0.40, 0.15, 10,  None,        None,         None),
    ("Pune",    "Bengaluru",   839,  14.0, "truck", 0.55, 0.20, 11,  None,        None,         None),
    ("Pune",    "Hyderabad",   560,  9.5,  "truck", 0.50, 0.20, 11,  None,        None,         None),
    ("Nagpur",  "Delhi",       1082, 18.0, "truck", 0.45, 0.20, 11,  None,        None,         None),
    ("Nagpur",  "Kolkata",     1084, 18.0, "truck", 0.45, 0.20, 11,  None,        "PORT_KOL",   None),
    # Kochi routes
    ("Kochi",   "Bengaluru",   561,  9.5,  "truck", 0.45, 0.15, 10,  "PORT_KOC",  None,         None),
    ("Kochi",   "Chennai",     682,  11.5, "truck", 0.45, 0.20, 11,  "PORT_KOC",  "PORT_CHN",   None),
    # Kandla routes
    ("Kandla",  "Ahmedabad",   353,  6.0,  "truck", 0.40, 0.15, 10,  "PORT_KAN",  None,         None),
    ("Kandla",  "Mumbai",      614,  10.5, "truck", 0.45, 0.20, 11,  "PORT_KAN",  "PORT_MUM",   None),
    ("Kandla",  "Delhi",       1017, 17.0, "truck", 0.45, 0.20, 11,  "PORT_KAN",  None,         None),
    # Visakhapatnam routes
    ("Visakhapatnam", "Hyderabad", 619, 10.5, "truck", 0.45, 0.20, 10, "PORT_VIZ", None,        None),
    ("Visakhapatnam", "Kolkata",   905, 15.0, "truck", 0.45, 0.20, 10, "PORT_VIZ", "PORT_KOL",  None),
    # Rail routes (faster, lower cost)
    ("Mumbai", "Delhi",        1384, 18.0, "rail",  0.30, 0.10, 6,   "PORT_MUM",  None,         None),
    ("Mumbai", "Ahmedabad",    492,  7.0,  "rail",  0.25, 0.10, 5,   "PORT_MUM",  None,         None),
    ("Delhi",  "Kolkata",      1456, 18.0, "rail",  0.30, 0.10, 6,   None,        "PORT_KOL",   None),
    ("Chennai","Delhi",        2173, 26.0, "rail",  0.35, 0.15, 6,   "PORT_CHN",  None,         None),
    ("Mumbai", "Chennai",      1279, 16.0, "rail",  0.35, 0.15, 6,   "PORT_MUM",  "PORT_CHN",   None),
    ("Mundra", "Delhi",        990,  14.0, "rail",  0.25, 0.10, 5,   "PORT_MUN",  None,         None),
]

# Cargo types with value ranges (INR), temperature ranges if cold-chain
CARGO_CONFIGS = [
    {"type": "Electronics",       "value_min": 500000,  "value_max": 5000000,  "temp_sensitive": False, "priority_range": (1, 2), "weight_range": (500, 5000)},
    {"type": "Pharmaceuticals",   "value_min": 800000,  "value_max": 8000000,  "temp_sensitive": True,  "temp_min": 2,  "temp_max": 8,  "priority_range": (1, 2), "weight_range": (100, 2000)},
    {"type": "Vaccines",          "value_min": 1000000, "value_max": 10000000, "temp_sensitive": True,  "temp_min": 2,  "temp_max": 8,  "priority_range": (1, 1), "weight_range": (50, 500)},
    {"type": "Fresh Produce",     "value_min": 100000,  "value_max": 1000000,  "temp_sensitive": True,  "temp_min": 4,  "temp_max": 12, "priority_range": (2, 3), "weight_range": (1000, 20000)},
    {"type": "Dairy Products",    "value_min": 150000,  "value_max": 1500000,  "temp_sensitive": True,  "temp_min": 1,  "temp_max": 6,  "priority_range": (1, 2), "weight_range": (500, 10000)},
    {"type": "Frozen Seafood",    "value_min": 200000,  "value_max": 2000000,  "temp_sensitive": True,  "temp_min": -18,"temp_max": -10,"priority_range": (2, 3), "weight_range": (500, 8000)},
    {"type": "Automotive Parts",  "value_min": 300000,  "value_max": 3000000,  "temp_sensitive": False, "priority_range": (2, 3), "weight_range": (2000, 15000)},
    {"type": "Textiles",          "value_min": 50000,   "value_max": 800000,   "temp_sensitive": False, "priority_range": (3, 4), "weight_range": (1000, 10000)},
    {"type": "Chemicals",         "value_min": 200000,  "value_max": 2000000,  "temp_sensitive": False, "priority_range": (2, 3), "weight_range": (2000, 20000)},
    {"type": "FMCG",              "value_min": 80000,   "value_max": 1200000,  "temp_sensitive": False, "priority_range": (3, 4), "weight_range": (500, 8000)},
    {"type": "Heavy Machinery",   "value_min": 2000000, "value_max": 20000000, "temp_sensitive": False, "priority_range": (2, 3), "weight_range": (5000, 50000)},
    {"type": "Medical Equipment", "value_min": 500000,  "value_max": 5000000,  "temp_sensitive": False, "priority_range": (1, 2), "weight_range": (200, 5000)},
    {"type": "Raw Steel",         "value_min": 100000,  "value_max": 1500000,  "temp_sensitive": False, "priority_range": (3, 4), "weight_range": (10000, 50000)},
    {"type": "Food Grains",       "value_min": 50000,   "value_max": 800000,   "temp_sensitive": False, "priority_range": (2, 3), "weight_range": (5000, 50000)},
    {"type": "Crude Oil",         "value_min": 5000000, "value_max": 50000000, "temp_sensitive": False, "priority_range": (2, 3), "weight_range": (50000, 500000)},
]

CARRIERS = [
    "Mahindra Logistics", "TCI Express", "BlueDart Logistics", "DHL India",
    "Gati Ltd", "Rivigo", "Delhivery", "Ecom Express", "DTDC",
    "Indian Railways Cargo", "Concor", "VRL Logistics", "SRS Cargo",
    "Safexpress", "TransIndia", "GATI-KWE"
]

NODE_NAMES = [
    "Mumbai", "JNPT", "Mundra", "Chennai", "Kolkata", "Kochi", "Visakhapatnam", "Kandla",
    "Pune", "Ahmedabad", "Delhi", "Bengaluru", "Hyderabad", "Jaipur", "Lucknow",
    "Surat", "Nagpur"
]


def generate_routes(db: Session) -> list:
    """Create route records and return them."""
    routes = []
    for i, rt in enumerate(ROUTES_TEMPLATE):
        (origin, dest, dist, time, mode, cong, risk, cpm, op_id, dp_id, alt) = rt
        route_id = f"ROUTE_{origin.upper().replace(' ', '_')[:4]}_{dest.upper().replace(' ', '_')[:4]}_{mode.upper()[:1]}_{i:03d}"
        r = Route(
            route_id=route_id,
            name=f"{origin} → {dest} ({mode.title()})",
            origin=origin,
            destination=dest,
            origin_port_id=op_id,
            dest_port_id=dp_id,
            distance_km=dist,
            normal_time_hours=time,
            transport_mode=mode,
            congestion=cong,
            risk_score=risk,
            cost_per_km=cpm,
            is_active=True,
            is_alternative=(alt is not None),
        )
        routes.append(r)
    db.add_all(routes)
    db.flush()
    return routes


def generate_shipments(db: Session, routes: list, num_shipments: int = 250) -> list:
    """Generate realistic shipments distributed across routes."""
    now = datetime.utcnow()
    shipments = []

    # Weight routes by busyness (shorter, higher traffic routes get more shipments)
    route_weights = []
    for r in routes:
        weight = max(0.1, 1.0 - r.congestion * 0.3)  # busier routes => more shipments
        if r.transport_mode == "truck":
            weight *= 2  # trucks carry more shipments
        route_weights.append(weight)
    total_w = sum(route_weights)
    route_probs = [w / total_w for w in route_weights]

    # Get port IDs for shipment association
    port_origins = {r.origin: r.origin_port_id for r in routes if r.origin_port_id}

    for i in range(num_shipments):
        # Pick a route
        route = random.choices(routes, weights=route_probs, k=1)[0]
        cargo = random.choice(CARGO_CONFIGS)
        priority = random.randint(*cargo["priority_range"])
        departure_offset = timedelta(hours=random.uniform(-72, 0))
        departure = now + departure_offset
        base_travel = route.normal_time_hours
        expected_arrival = departure + timedelta(hours=base_travel)
        progress = max(0.0, min(100.0, (-departure_offset.total_seconds() / 3600) / base_travel * 100))
        cargo_value = random.uniform(cargo["value_min"], cargo["value_max"])
        weight = random.uniform(*cargo["weight_range"])

        shipment = Shipment(
            shipment_id=f"SHP_{i+1:04d}",
            origin=route.origin,
            destination=route.destination,
            current_location=route.origin if progress < 20 else route.destination if progress > 80 else f"En route: {route.origin}→{route.destination}",
            route_id=route.route_id,
            port_id=route.origin_port_id,
            carrier=random.choice(CARRIERS),
            cargo_type=cargo["type"],
            cargo_value=round(cargo_value, 2),
            weight_kg=round(weight, 1),
            volume_m3=round(weight / 400, 2),
            priority=priority,
            temperature_sensitive=cargo.get("temp_sensitive", False),
            required_temp_min=cargo.get("temp_min", None),
            required_temp_max=cargo.get("temp_max", None),
            current_temperature=round(random.uniform(cargo.get("temp_min", 20), cargo.get("temp_max", 25)), 1) if cargo.get("temp_sensitive") else None,
            departure_time=departure,
            expected_arrival=expected_arrival,
            status=random.choices(
                ["in_transit", "in_transit", "in_transit", "at_port", "delayed"],
                weights=[0.60, 0.15, 0.10, 0.10, 0.05]
            )[0],
            estimated_delay_hours=0.0,
            risk_score=round(random.uniform(0.1, 0.4), 3),
            progress_pct=round(progress, 1),
        )
        shipments.append(shipment)

    db.add_all(shipments)
    db.flush()
    return shipments


def generate_fleet(db: Session) -> list:
    """Generate realistic fleet assets."""
    fleet = []
    locations = [
        ("Mumbai", 19.0760, 72.8777),
        ("JNPT", 18.9507, 72.9492),
        ("Pune", 18.5204, 73.8567),
        ("Ahmedabad", 23.0225, 72.5714),
        ("Delhi", 28.6139, 77.2090),
        ("Bengaluru", 12.9716, 77.5946),
        ("Hyderabad", 17.3850, 78.4867),
        ("Chennai", 13.0827, 80.2707),
        ("Kolkata", 22.5726, 88.3639),
        ("Mundra", 22.8390, 69.7218),
        ("Kandla", 23.0333, 70.2167),
        ("Nagpur", 21.1458, 79.0882),
        ("Surat", 21.1702, 72.8311),
        ("Jaipur", 26.9124, 75.7873),
        ("Lucknow", 26.8467, 80.9462),
        ("Kochi", 9.9312, 76.2673),
        ("Visakhapatnam", 17.6868, 83.2185),
    ]

    vehicle_configs = [
        # (type, capacity_kg, capacity_m3, speed, cost_per_km, is_refrigerated, min_temp, max_temp, count)
        ("truck",  20000, 60,  65, 15, False, None, None, 30),
        ("truck",  10000, 30,  70, 12, False, None, None, 20),
        ("truck",  5000,  15,  75, 10, False, None, None, 10),
        ("truck",  15000, 45,  60, 18, True,  -20,  8,   15),
        ("truck",  8000,  24,  65, 15, True,  -20,  8,    8),
        ("rail",   100000, 500, 80, 6, False, None, None,  5),
        ("rail",   60000, 300,  80, 5, True,  -5,   8,    3),
        ("ship",   500000, 2000, 20, 3, False, None, None, 4),
    ]

    idx = 0
    for vtype, cap_kg, cap_m3, speed, cost, refrig, t_min, t_max, count in vehicle_configs:
        for j in range(count):
            loc = random.choice(locations)
            avail = random.random() > 0.40  # ~60% available
            util = random.uniform(0.0, 0.4) if avail else random.uniform(0.6, 1.0)
            fleet_item = Fleet(
                vehicle_id=f"VEH_{idx+1:04d}",
                vehicle_type=vtype,
                name=f"{vtype.title()} {idx+1:04d}",
                carrier=random.choice(CARRIERS),
                capacity_kg=cap_kg,
                capacity_m3=cap_m3,
                current_location=loc[0],
                latitude=loc[1] + random.uniform(-0.5, 0.5),
                longitude=loc[2] + random.uniform(-0.5, 0.5),
                availability=avail,
                utilization=round(util, 2),
                is_refrigerated=refrig,
                min_temp=t_min,
                max_temp=t_max,
                operating_cost_per_km=cost,
                speed_kmh=speed,
            )
            fleet.append(fleet_item)
            idx += 1

    db.add_all(fleet)
    db.flush()
    return fleet


def generate_weather_events(db: Session) -> list:
    """Generate some weather events."""
    now = datetime.utcnow()
    events = [
        WeatherEvent(
            event_id="WE_001",
            event_type="cyclone",
            location="Bay of Bengal",
            latitude=15.0,
            longitude=85.0,
            severity=0.6,
            radius_km=200.0,
            start_time=now - timedelta(hours=12),
            end_time=now + timedelta(hours=36),
            affected_routes=json.dumps(["ROUTE_CHE_VIS_T_018", "ROUTE_CHE_KOL_T_021"]),
            is_active=True,
        ),
        WeatherEvent(
            event_id="WE_002",
            event_type="heavy_rain",
            location="Western Ghats",
            latitude=16.5,
            longitude=74.0,
            severity=0.4,
            radius_km=150.0,
            start_time=now - timedelta(hours=6),
            end_time=now + timedelta(hours=18),
            affected_routes=json.dumps([]),
            is_active=True,
        ),
    ]
    db.add_all(events)
    db.flush()
    return events


def generate_iot_readings(db: Session, shipments: list, count: int = 500):
    """Generate IoT temperature/location readings for cold-chain shipments."""
    cold_shipments = [s for s in shipments if s.temperature_sensitive]
    if not cold_shipments:
        return

    now = datetime.utcnow()
    readings = []
    for i in range(min(count, len(cold_shipments) * 10)):
        s = random.choice(cold_shipments)
        offset_hours = random.uniform(-24, 0)
        base_temp = s.current_temperature or (
            (s.required_temp_min + s.required_temp_max) / 2 if s.required_temp_min and s.required_temp_max else 4.0
        )
        # Occasional temperature excursions
        temp_drift = random.gauss(0, 1.5)
        reading = IotReading(
            reading_id=f"IOT_{i+1:05d}",
            shipment_id=s.shipment_id,
            timestamp=now + timedelta(hours=offset_hours),
            temperature=round(base_temp + temp_drift, 1),
            humidity=round(random.uniform(30, 80), 1),
            latitude=random.uniform(8, 30),
            longitude=random.uniform(68, 88),
            shock_detected=random.random() < 0.02,
            door_open=random.random() < 0.05,
        )
        readings.append(reading)

    db.add_all(readings)
    db.flush()


def seed_database():
    """Main function: initialise DB and seed all data."""
    print("Initializing database...")
    init_db()

    db: Session = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Port).count() > 0:
            print("Database already seeded. Clearing and re-seeding...")
            db.query(IotReading).delete()
            db.query(WeatherEvent).delete()
            db.query(Fleet).delete()
            db.query(Shipment).delete()
            db.query(Route).delete()
            db.query(Warehouse).delete()
            db.query(Port).delete()
            db.commit()

        print("Seeding ports...")
        ports = []
        for p in PORTS_DATA:
            port = Port(**p, operational_status="operational", current_load=int(p["capacity"] * p.get("congestion", 0.5)))
            ports.append(port)
        db.add_all(ports)
        db.flush()

        print("Seeding warehouses...")
        warehouses = []
        for w in WAREHOUSES_DATA:
            wh = Warehouse(**w, operational_status="operational")
            warehouses.append(wh)
        db.add_all(warehouses)
        db.flush()

        print("Generating routes...")
        routes = generate_routes(db)

        print("Generating shipments (250)...")
        shipments = generate_shipments(db, routes, num_shipments=250)

        print("Generating fleet assets...")
        fleet = generate_fleet(db)

        print("Generating weather events...")
        weather = generate_weather_events(db)

        print("Generating IoT readings (500)...")
        generate_iot_readings(db, shipments, count=500)

        db.commit()
        print(f"\n[OK] Dataset generation complete!")
        print(f"   Ports:         {db.query(Port).count()}")
        print(f"   Warehouses:    {db.query(Warehouse).count()}")
        print(f"   Routes:        {db.query(Route).count()}")
        print(f"   Shipments:     {db.query(Shipment).count()}")
        print(f"   Fleet assets:  {db.query(Fleet).count()}")
        print(f"   Weather events:{db.query(WeatherEvent).count()}")
        print(f"   IoT readings:  {db.query(IotReading).count()}")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
