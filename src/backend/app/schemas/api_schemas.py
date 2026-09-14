"""Pydantic schemas for ChainMind AI API."""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class DisruptionType(str, Enum):
    port_closure = "port_closure"
    route_closure = "route_closure"
    severe_weather = "severe_weather"
    strike = "strike"
    vehicle_shortage = "vehicle_shortage"
    fuel_price_increase = "fuel_price_increase"
    demand_spike = "demand_spike"
    warehouse_disruption = "warehouse_disruption"


class SeverityLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


# ── Request Schemas ────────────────────────────────────────────────────────────

class SimulationRequest(BaseModel):
    disruption_type: DisruptionType = Field(..., description="Type of disruption")
    location: str = Field(..., min_length=2, max_length=100, description="Affected location name")
    duration_hours: float = Field(..., gt=0, le=720, description="Disruption duration in hours")
    severity: SeverityLevel = Field(SeverityLevel.medium, description="Disruption severity")
    capacity_reduction: float = Field(1.0, ge=0.0, le=1.0, description="Fraction of capacity blocked (0-1)")
    delay_multiplier: Optional[float] = Field(None, gt=0, le=10.0)
    cost_multiplier: Optional[float] = Field(None, gt=0, le=10.0)
    temperature_risk_multiplier: Optional[float] = Field(None, gt=0, le=5.0)

    class Config:
        json_schema_extra = {
            "example": {
                "disruption_type": "port_closure",
                "location": "Mumbai Port",
                "duration_hours": 72,
                "severity": "high",
                "capacity_reduction": 1.0,
            }
        }


class WhatIfRequest(BaseModel):
    scenarios: List[SimulationRequest] = Field(..., min_length=2, max_length=5)


# ── Response Schemas ───────────────────────────────────────────────────────────

class PortSchema(BaseModel):
    port_id: str
    name: str
    city: str
    state: Optional[str]
    latitude: float
    longitude: float
    capacity: Optional[int]
    congestion: float
    operational_status: str
    annual_throughput: Optional[int]

    class Config:
        from_attributes = True


class WarehouseSchema(BaseModel):
    warehouse_id: str
    name: str
    city: str
    state: Optional[str]
    latitude: float
    longitude: float
    capacity: Optional[int]
    current_utilization: float
    has_cold_storage: bool
    operational_status: str

    class Config:
        from_attributes = True


class RouteSchema(BaseModel):
    route_id: str
    name: Optional[str]
    origin: str
    destination: str
    distance_km: float
    normal_time_hours: float
    transport_mode: str
    congestion: float
    risk_score: float
    cost_per_km: float
    is_active: bool
    origin_port_id: Optional[str]
    dest_port_id: Optional[str]

    class Config:
        from_attributes = True


class ShipmentSchema(BaseModel):
    shipment_id: str
    origin: str
    destination: str
    current_location: Optional[str]
    route_id: Optional[str]
    port_id: Optional[str]
    carrier: Optional[str]
    cargo_type: Optional[str]
    cargo_value: Optional[float]
    weight_kg: Optional[float]
    priority: int
    temperature_sensitive: bool
    required_temp_min: Optional[float]
    required_temp_max: Optional[float]
    current_temperature: Optional[float]
    departure_time: Optional[datetime]
    expected_arrival: Optional[datetime]
    status: str
    estimated_delay_hours: float
    risk_score: float
    progress_pct: float

    class Config:
        from_attributes = True


class FleetSchema(BaseModel):
    vehicle_id: str
    vehicle_type: str
    carrier: Optional[str]
    current_location: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    capacity_kg: Optional[float]
    availability: bool
    utilization: float
    is_refrigerated: bool
    operating_cost_per_km: float

    class Config:
        from_attributes = True


class ImpactSummary(BaseModel):
    total_affected_shipments: int
    directly_affected: int
    indirectly_affected: int
    total_cargo_value_exposed: float
    average_delay_hours: float
    high_priority_affected: int
    cold_chain_at_risk: int
    disrupted_routes: int


class RiskDistribution(BaseModel):
    low: int = 0
    medium: int = 0
    high: int = 0
    critical: int = 0


class ActionStep(BaseModel):
    time: str
    actions: List[str]


class StrategySchema(BaseModel):
    strategy_id: str
    strategy_type: str
    name: str
    description: str
    additional_cost_inr: float
    average_delay_hours: float
    risk_level: str
    affected_shipments: int
    cold_chain_risk_score: float
    fleet_required: int
    is_recommended: bool
    strategy_score: Optional[float]
    action_plan: List[Dict[str, Any]]


class SimulationResponse(BaseModel):
    simulation_id: str
    scenario: Dict[str, Any]
    impact_summary: ImpactSummary
    risk_distribution: RiskDistribution
    delay_distribution: Dict[str, int]
    top_risk_shipments: List[Dict[str, Any]]
    fleet_summary: Dict[str, Any]
    available_fleet: List[Dict[str, Any]]
    cold_chain_fleet: List[Dict[str, Any]]
    fleet_requirements: Dict[str, Any]
    strategies: List[StrategySchema]
    recommended_strategy: Optional[Dict[str, Any]]
    disrupted_route_ids: List[str]
    completed_at: Optional[str]
    explanation: Optional[Dict[str, Any]] = None


class DashboardSummary(BaseModel):
    total_shipments: int
    in_transit: int
    delayed: int
    at_port: int
    delivered: int
    total_cargo_value: float
    cold_chain_shipments: int
    high_priority_shipments: int
    fleet_summary: Dict[str, Any]
    ports: List[Dict[str, Any]]
    recent_simulations: List[Dict[str, Any]]


class WhatIfComparison(BaseModel):
    scenarios: List[Dict[str, Any]]
    comparison: Dict[str, Any]
