import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Port {
  port_id: string;
  name: string;
  city: string;
  state?: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  congestion: number;
  operational_status: string;
}

export interface Route {
  route_id: string;
  name?: string;
  origin: string;
  destination: string;
  distance_km: number;
  normal_time_hours: number;
  transport_mode: string;
  congestion: number;
  risk_score: number;
  cost_per_km: number;
  is_active: boolean;
  origin_port_id?: string;
  dest_port_id?: string;
}

export interface Shipment {
  shipment_id: string;
  origin: string;
  destination: string;
  cargo_type?: string;
  cargo_value?: number;
  priority: number;
  temperature_sensitive: boolean;
  status: string;
  estimated_delay_hours: number;
  risk_score: number;
  progress_pct: number;
  carrier?: string;
  weight_kg?: number;
  required_temp_min?: number;
  required_temp_max?: number;
  current_temperature?: number;
}

export interface FleetVehicle {
  vehicle_id: string;
  vehicle_type: string;
  carrier?: string;
  current_location?: string;
  capacity_kg?: number;
  capacity_m3?: number;
  is_refrigerated: boolean;
  min_temp?: number;
  max_temp?: number;
  utilization?: number;
  distance_km?: number;
  reposition_hours?: number;
  reposition_cost_inr?: number;
  operating_cost_per_km?: number;
  speed_kmh?: number;
  score?: number;
}

export interface FleetSummary {
  total_vehicles: number;
  available_vehicles: number;
  utilized_vehicles: number;
  refrigerated_vehicles: number;
  refrigerated_available: number;
  average_utilization: number;
  utilization_pct: number;
}

export interface DashboardSummary {
  total_shipments: number;
  in_transit: number;
  delayed: number;
  at_port: number;
  at_warehouse: number;
  delivered: number;
  total_cargo_value: number;
  cold_chain_shipments: number;
  high_priority_shipments: number;
  fleet_summary: FleetSummary;
  ports: Port[];
  recent_simulations: SimulationSummary[];
}

export interface SimulationSummary {
  simulation_id: string;
  scenario_name: string;
  disruption_type: string;
  location: string;
  duration_hours: number;
  severity: string;
  total_affected_shipments: number;
  total_cargo_value_exposed: number;
  average_delay_hours: number;
  recommended_strategy?: string;
  status: string;
  created_at?: string;
}

export interface RecoveryStrategy {
  strategy_id: string;
  strategy_type: string;
  name: string;
  description: string;
  additional_cost_inr: number;
  average_delay_hours: number;
  risk_level: string;
  affected_shipments: number;
  cold_chain_risk_score: number;
  fleet_required: number;
  is_recommended: boolean;
  strategy_score?: number;
  action_plan: Array<{ time: string; actions: string[] }>;
}

export interface ImpactSummary {
  total_affected_shipments: number;
  directly_affected: number;
  indirectly_affected: number;
  total_cargo_value_exposed: number;
  average_delay_hours: number;
  high_priority_affected: number;
  cold_chain_at_risk: number;
  disrupted_routes: number;
}

export interface SimulationResult {
  simulation_id: string;
  scenario: {
    disruption_type: string;
    location: string;
    duration_hours: number;
    severity: string;
    severity_score: number;
  };
  impact_summary: ImpactSummary;
  risk_distribution: { low: number; medium: number; high: number; critical: number };
  delay_distribution: Record<string, number>;
  top_risk_shipments: Array<{
    shipment_id: string;
    risk_score: number;
    risk_level: string;
    delay_hours: number;
    cargo_value: number;
    cold_chain_risk: number;
    is_direct: boolean;
  }>;
  fleet_summary: FleetSummary;
  available_fleet: FleetVehicle[];
  cold_chain_fleet: FleetVehicle[];
  fleet_requirements: {
    standard_vehicles_needed: number;
    refrigerated_vehicles_needed: number;
    total_vehicles_needed: number;
  };
  strategies: RecoveryStrategy[];
  recommended_strategy: {
    strategy_type: string;
    name: string;
    additional_cost_inr: number;
    average_delay_hours: number;
    risk_level: string;
  } | null;
  disrupted_route_ids: string[];
  completed_at?: string;
  explanation?: {
    explanation: string;
    crisis_summary: string;
    used_llm: boolean;
    llm_provider: string;
    explanation_basis: {
      cost_reasoning: { value: number; vs_cheapest: number; vs_fastest: number; label: string };
      delay_reasoning: { value: number; vs_cheapest: number; vs_fastest: number; label: string };
      risk_reasoning: { level: string; cold_chain_risk: number; cold_chain_count: number; label: string };
      cargo_reasoning: { total_value: number; high_priority: number; label: string };
      fleet_reasoning: { vehicles_required: number; available: number; label: string };
    };
  };
}

export interface SimulationRequest {
  disruption_type: string;
  location: string;
  duration_hours: number;
  severity: string;
  capacity_reduction?: number;
  delay_multiplier?: number;
  cost_multiplier?: number;
  temperature_risk_multiplier?: number;
}

export interface WhatIfResult {
  scenarios: SimulationResult[];
  comparison: {
    scenario_ids: string[];
    scenario_labels: string[];
    metrics: Record<string, number[]>;
    recommended_strategies: Array<{
      simulation_id: string;
      strategy_type?: string;
      name?: string;
      additional_cost_inr?: number;
      average_delay_hours?: number;
      risk_level?: string;
    }>;
    worst_scenario_idx: number;
    best_scenario_idx: number;
    delay_increase_pct: number;
  };
}

// ── API Calls ─────────────────────────────────────────────────────────────────

export const getHealth = () => api.get('/health').then(r => r.data);

export const getDashboardSummary = (): Promise<DashboardSummary> =>
  api.get('/dashboard/summary').then(r => r.data);

export const getPorts = (): Promise<Port[]> =>
  api.get('/ports').then(r => r.data);

export const getRoutes = (activeOnly = true): Promise<Route[]> =>
  api.get(`/routes?active_only=${activeOnly}`).then(r => r.data);

export const getShipments = (params?: {
  status?: string;
  priority?: number;
  temperature_sensitive?: boolean;
  limit?: number;
}): Promise<{ total: number; shipments: Shipment[] }> =>
  api.get('/shipments', { params }).then(r => r.data);

export const getFleet = () => api.get('/fleet').then(r => r.data);

export const runSimulation = (request: SimulationRequest): Promise<SimulationResult> =>
  api.post('/simulate', request).then(r => r.data);

export const getSimulation = (id: string) =>
  api.get(`/simulations/${id}`).then(r => r.data);

export const getSimulations = (): Promise<SimulationSummary[]> =>
  api.get('/simulations').then(r => r.data);

export const runWhatIf = (scenarios: SimulationRequest[]): Promise<WhatIfResult> =>
  api.post('/what-if', scenarios).then(r => r.data);

export const getImpact = (simId: string) =>
  api.get(`/impact/${simId}`).then(r => r.data);

export const getColdChain = (simId: string) =>
  api.get(`/cold-chain/${simId}`).then(r => r.data);

export const getWarehouses = () =>
  api.get('/warehouses').then(r => r.data);


// ── Round 2: Manual Mode Types ────────────────────────────────────────────────

export interface ConditionInput {
  scope_type: string;
  scope_name: string;
  rainfall_mm?: number;
  humidity_pct?: number;
  temperature_c?: number;
  traffic_level?: number;
  road_condition?: number;
  port_congestion?: number;
  weather_severity?: number;
  wind_speed_kmh?: number;
  visibility_km?: number;
}

export interface DirectDisruptionInput {
  disruption_type: string;
  scope_type: string;
  scope_name: string;
  severity: string;
  duration_hours: number;
  capacity_reduction: number;
  causal_reason?: string;
  connection_id?: string;
}

export interface ManualSimulationRequest {
  conditions: ConditionInput[];
  direct_disruptions: DirectDisruptionInput[];
  interrupt_connection_ids: string[];
  run_label?: string;
  include_explanation?: boolean;
}

export interface ConnectionRecord {
  connection_id: string;
  name?: string;
  from_node: string;
  to_node: string;
  transport_mode: string;
  distance_km: number;
  normal_time_hours: number;
  status: string;  // available / degraded / unavailable
  disruption_reason?: string;
  route_id?: string;
  disrupted_at?: string;
  restored_at?: string;
}

export interface CausalViolation {
  condition: string;
  scope: string;
  value: number;
  threshold: number;
  severity: string;
  consequence: string;
}

export interface CausalGeneratedDisruption {
  disruption_type: string;
  scope_name: string;
  severity: string;
  causal_reason: string;
  duration_hours: number;
  capacity_reduction: number;
}

export interface CausalInfo {
  violations: CausalViolation[];
  generated_disruptions: CausalGeneratedDisruption[];
  causal_narrative: string;
  event_log: Array<Record<string, unknown>>;
}

export interface SimulationEventRecord {
  event_id: string;
  sequence: number;
  stage: string;
  event_type: string;
  severity?: string;
  affected_entity?: string;
  summary?: string;
  timestamp?: string;
}

export interface ConnectionImpact {
  connection: ConnectionRecord;
  affected_route_count: number;
  affected_shipment_count: number;
  affected_route_ids: string[];
  affected_shipment_ids: string[];
}

export interface ManualSimResult extends SimulationResult {
  manual_mode?: boolean;
  run_label?: string;
  causal_info?: CausalInfo;
  connection_impact?: Record<string, ConnectionImpact>;
  simulation_events?: SimulationEventRecord[];
}

export interface ManualRunSummary {
  simulation_id: string;
  run_label?: string;
  mode: string;
  scenario_name?: string;
  disruption_type?: string;
  location?: string;
  duration_hours?: number;
  severity?: string;
  total_affected_shipments?: number;
  total_cargo_value_exposed?: number;
  average_delay_hours?: number;
  recommended_strategy?: string;
  status?: string;
  created_at?: string;
  source_conditions_count: number;
  source_disruptions_count: number;
  interrupted_connections: string[];
}

// ── Round 2: Manual Mode API Calls ────────────────────────────────────────────

export const runManualSimulation = (request: ManualSimulationRequest): Promise<ManualSimResult> =>
  api.post('/manual/simulate', request).then(r => r.data);

export const getConnections = (status?: string): Promise<ConnectionRecord[]> =>
  api.get('/manual/connections', { params: status ? { status } : {} }).then(r => r.data);

export const getConnectionById = (id: string): Promise<ConnectionRecord> =>
  api.get(`/manual/connections/${id}`).then(r => r.data);

export const interruptConnection = (id: string, reason: string, severity = 'high') =>
  api.post(`/manual/connections/${id}/interrupt`, { reason, severity }).then(r => r.data);

export const restoreConnection = (id: string) =>
  api.post(`/manual/connections/${id}/restore`).then(r => r.data);

export const getNodes = (): Promise<{ nodes: string[]; count: number }> =>
  api.get('/manual/nodes').then(r => r.data);

export const getManualHistory = (limit = 50): Promise<ManualRunSummary[]> =>
  api.get('/manual/history', { params: { limit } }).then(r => r.data);

export const getManualHistoryDetail = (simId: string) =>
  api.get(`/manual/history/${simId}`).then(r => r.data);

export const getSimulationEvents = (simId: string) =>
  api.get(`/manual/events/${simId}`).then(r => r.data);
