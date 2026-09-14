from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey, Enum
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()


class OperationalStatus(str, enum.Enum):
    operational = "operational"
    disrupted = "disrupted"
    congested = "congested"
    closed = "closed"


class ShipmentStatus(str, enum.Enum):
    in_transit = "in_transit"
    delayed = "delayed"
    at_port = "at_port"
    at_warehouse = "at_warehouse"
    delivered = "delivered"
    held = "held"


class VehicleType(str, enum.Enum):
    truck = "truck"
    rail = "rail"
    ship = "ship"
    air = "air"


class DisruptionType(str, enum.Enum):
    port_closure = "port_closure"
    route_closure = "route_closure"
    severe_weather = "severe_weather"
    strike = "strike"
    vehicle_shortage = "vehicle_shortage"
    fuel_price_increase = "fuel_price_increase"
    demand_spike = "demand_spike"
    warehouse_disruption = "warehouse_disruption"


class Port(Base):
    __tablename__ = "ports"

    port_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String)
    country = Column(String, default="India")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    capacity = Column(Integer)  # TEUs per day
    current_load = Column(Integer, default=0)
    congestion = Column(Float, default=0.0)  # 0.0-1.0
    operational_status = Column(String, default="operational")
    annual_throughput = Column(Integer)  # TEUs per year
    created_at = Column(DateTime, default=datetime.utcnow)

    shipments = relationship("Shipment", back_populates="port")
    routes_from = relationship("Route", foreign_keys="Route.origin_port_id", back_populates="origin_port")
    routes_to = relationship("Route", foreign_keys="Route.dest_port_id", back_populates="dest_port")


class Warehouse(Base):
    __tablename__ = "warehouses"

    warehouse_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String)
    country = Column(String, default="India")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    capacity = Column(Integer)  # cubic meters
    current_utilization = Column(Float, default=0.0)  # 0.0-1.0
    has_cold_storage = Column(Boolean, default=False)
    cold_storage_capacity = Column(Integer, default=0)
    operational_status = Column(String, default="operational")
    created_at = Column(DateTime, default=datetime.utcnow)


class Route(Base):
    __tablename__ = "routes"

    route_id = Column(String, primary_key=True)
    name = Column(String)
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    origin_port_id = Column(String, ForeignKey("ports.port_id"), nullable=True)
    dest_port_id = Column(String, ForeignKey("ports.port_id"), nullable=True)
    distance_km = Column(Float, nullable=False)
    normal_time_hours = Column(Float, nullable=False)
    transport_mode = Column(String, default="truck")
    congestion = Column(Float, default=0.0)  # 0.0-1.0
    risk_score = Column(Float, default=0.0)  # 0.0-1.0
    cost_per_km = Column(Float, default=10.0)  # INR
    is_active = Column(Boolean, default=True)
    is_alternative = Column(Boolean, default=False)
    alternative_for = Column(String, ForeignKey("routes.route_id"), nullable=True)
    waypoints_json = Column(Text)  # JSON list of lat/lng
    created_at = Column(DateTime, default=datetime.utcnow)

    origin_port = relationship("Port", foreign_keys=[origin_port_id], back_populates="routes_from")
    dest_port = relationship("Port", foreign_keys=[dest_port_id], back_populates="routes_to")
    shipments = relationship("Shipment", back_populates="route")


class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id = Column(String, primary_key=True)
    origin = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    current_location = Column(String)
    route_id = Column(String, ForeignKey("routes.route_id"), nullable=True)
    port_id = Column(String, ForeignKey("ports.port_id"), nullable=True)
    carrier = Column(String)
    cargo_type = Column(String)
    cargo_value = Column(Float)  # INR
    weight_kg = Column(Float)
    volume_m3 = Column(Float)
    priority = Column(Integer, default=3)  # 1=critical, 2=high, 3=medium, 4=low
    temperature_sensitive = Column(Boolean, default=False)
    required_temp_min = Column(Float, nullable=True)
    required_temp_max = Column(Float, nullable=True)
    current_temperature = Column(Float, nullable=True)
    departure_time = Column(DateTime)
    expected_arrival = Column(DateTime)
    status = Column(String, default="in_transit")
    estimated_delay_hours = Column(Float, default=0.0)
    risk_score = Column(Float, default=0.0)
    progress_pct = Column(Float, default=0.0)  # 0-100
    created_at = Column(DateTime, default=datetime.utcnow)

    route = relationship("Route", back_populates="shipments")
    port = relationship("Port", back_populates="shipments")


class Fleet(Base):
    __tablename__ = "fleet"

    vehicle_id = Column(String, primary_key=True)
    vehicle_type = Column(String, default="truck")
    name = Column(String)
    carrier = Column(String)
    capacity_kg = Column(Float)
    capacity_m3 = Column(Float)
    current_location = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    availability = Column(Boolean, default=True)
    utilization = Column(Float, default=0.0)  # 0.0-1.0
    is_refrigerated = Column(Boolean, default=False)
    min_temp = Column(Float, nullable=True)
    max_temp = Column(Float, nullable=True)
    operating_cost_per_km = Column(Float, default=15.0)  # INR
    speed_kmh = Column(Float, default=60.0)
    current_shipment_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class WeatherEvent(Base):
    __tablename__ = "weather_events"

    event_id = Column(String, primary_key=True)
    event_type = Column(String)  # cyclone, flood, drought, storm
    location = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    severity = Column(Float, default=0.5)  # 0.0-1.0
    radius_km = Column(Float, default=100.0)
    start_time = Column(DateTime)
    end_time = Column(DateTime, nullable=True)
    affected_routes = Column(Text)  # JSON list of route_ids
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class IotReading(Base):
    __tablename__ = "iot_readings"

    reading_id = Column(String, primary_key=True)
    shipment_id = Column(String, ForeignKey("shipments.shipment_id"))
    vehicle_id = Column(String, ForeignKey("fleet.vehicle_id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    latitude = Column(Float)
    longitude = Column(Float)
    shock_detected = Column(Boolean, default=False)
    door_open = Column(Boolean, default=False)


class Disruption(Base):
    __tablename__ = "disruptions"

    disruption_id = Column(String, primary_key=True)
    disruption_type = Column(String, nullable=False)
    location = Column(String, nullable=False)
    location_type = Column(String)  # port, route, warehouse, region
    severity = Column(String, default="medium")  # low, medium, high
    severity_score = Column(Float, default=0.5)  # 0.0-1.0
    duration_hours = Column(Float, nullable=False)
    capacity_reduction = Column(Float, default=1.0)  # fraction blocked
    delay_multiplier = Column(Float, default=1.5)
    cost_multiplier = Column(Float, default=1.2)
    temperature_risk_multiplier = Column(Float, default=1.0)
    start_time = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    simulation_id = Column(String, primary_key=True)
    scenario_name = Column(String)
    disruption_type = Column(String)
    location = Column(String)
    duration_hours = Column(Float)
    severity = Column(String)
    severity_score = Column(Float)
    capacity_reduction = Column(Float, default=1.0)
    delay_multiplier = Column(Float, default=1.5)
    cost_multiplier = Column(Float, default=1.2)
    temperature_risk_multiplier = Column(Float, default=1.0)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String, default="running")  # running, completed, failed
    # Summary fields cached for quick access
    total_affected_shipments = Column(Integer, default=0)
    total_cargo_value_exposed = Column(Float, default=0.0)
    average_delay_hours = Column(Float, default=0.0)
    high_priority_affected = Column(Integer, default=0)
    cold_chain_at_risk = Column(Integer, default=0)
    recommended_strategy = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    results = relationship("SimulationResult", back_populates="simulation")
    strategies = relationship("RecoveryStrategy", back_populates="simulation")


class SimulationResult(Base):
    __tablename__ = "simulation_results"

    result_id = Column(String, primary_key=True)
    simulation_id = Column(String, ForeignKey("simulation_runs.simulation_id"))
    shipment_id = Column(String, ForeignKey("shipments.shipment_id"))
    is_directly_affected = Column(Boolean, default=False)
    is_indirectly_affected = Column(Boolean, default=False)
    estimated_delay_hours = Column(Float, default=0.0)
    original_route_id = Column(String, nullable=True)
    alternative_route_id = Column(String, nullable=True)
    cargo_value = Column(Float, default=0.0)
    cold_chain_risk = Column(Float, default=0.0)  # 0.0-1.0
    risk_level = Column(String, default="low")  # low, medium, high, critical
    risk_score = Column(Float, default=0.0)
    recovery_cost = Column(Float, default=0.0)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    simulation = relationship("SimulationRun", back_populates="results")


class RecoveryStrategy(Base):
    __tablename__ = "recovery_strategies"

    strategy_id = Column(String, primary_key=True)
    simulation_id = Column(String, ForeignKey("simulation_runs.simulation_id"))
    strategy_type = Column(String)  # cheapest, fastest, balanced
    name = Column(String)
    description = Column(Text)
    additional_cost = Column(Float, default=0.0)  # INR
    average_delay_hours = Column(Float, default=0.0)
    risk_level = Column(String, default="medium")
    affected_shipments = Column(Integer, default=0)
    cold_chain_risk_score = Column(Float, default=0.0)
    fleet_required = Column(Integer, default=0)
    strategy_score = Column(Float, default=0.0)  # lower is better
    is_recommended = Column(Boolean, default=False)
    action_plan_json = Column(Text)  # JSON list of actions
    explanation = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    simulation = relationship("SimulationRun", back_populates="strategies")
