# Solution Overview

## What We Built

ChainMind AI is an **AI-Powered Supply Chain Crisis Simulator** built on a Supply Chain Digital Twin. It transforms the question "what is happening now?" into "what would happen if...?" — enabling operators to simulate disruptions before they happen, compare recovery strategies, and act with data-driven confidence.

## Core Concept: Predict → Simulate → Compare → Optimize → Explain → Act

```
Operator Input (Disruption Scenario)
         ↓
Digital Twin State (250 shipments, 48 routes, 8 ports, 95 fleet assets)
         ↓
Disruption Applied (port closure, weather, strike, etc.)
         ↓
Cascading Impact Calculation (direct + indirect shipments)
         ↓
Per-Shipment Risk Scoring (delay + value + cold-chain + priority + route risk)
         ↓
Route Optimization (NetworkX graph algorithms — Dijkstra-based)
         ↓
Fleet Allocation (proximity + refrigeration + capacity matching)
         ↓
Recovery Strategy Generation (Cheapest | Fastest | AI-Recommended)
         ↓
Strategy Scoring (multi-factor: cost 25% + delay 30% + cold-chain 25% + risk 20%)
         ↓
LLM Explanation (human-readable decision rationale)
         ↓
Operator Action Plan (immediate / 6h / 24h steps)
```

## How It Works

1. **Operator configures a scenario**: Disruption type (port closure, weather, strike, etc.), location, duration, severity
2. **Simulation engine loads the digital twin**: Current shipment positions, route states, fleet availability
3. **Disruption is applied**: Affected routes and ports are removed from the logistics graph
4. **Cascading impact is calculated**: Directly blocked shipments + indirectly affected downstream shipments
5. **Per-shipment risk is scored**: Transparent formula combining delay, cargo value, cold-chain exposure, priority, route risk, fleet availability
6. **Route optimizer finds alternatives**: NetworkX shortest-path algorithms on a weighted logistics graph
7. **Fleet optimizer identifies available assets**: Distance-ranked, refrigeration-matched fleet recommendations
8. **Three recovery strategies are generated**: Each with different cost/delay/risk trade-offs
9. **Decision engine selects the recommendation**: Multi-factor scoring picks the optimal strategy
10. **LLM generates explanation**: Human-readable rationale (or template fallback if no LLM configured)
11. **Operator sees action plan**: Time-phased steps (immediate, 6h, 24h)

## What-If Comparison

The "supply-chain time machine" feature allows comparison of multiple scenarios:
- Mumbai Port closed 72h vs 120h vs 240h
- High severity vs medium severity
- One port vs another

Results change dynamically based on parameters — no hardcoded outputs.

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Deterministic simulation core | Reproducible, auditable results — LLM cannot change simulation outcomes |
| SQLite default, PostgreSQL-ready | Zero setup for demo, production-scalable |
| NetworkX graph for routing | Industry-standard graph library, efficient pathfinding |
| Template fallback for LLM | Application works without any API key |
| Synthetic India logistics dataset | Reliable demo without external API dependencies |
| scikit-learn ML models | Trained on synthetic data for delay/risk prediction augmentation |

## IBM Technologies Used

- **IBM Bob**: Primary development agent for the entire ChainMind AI system. Bob designed the architecture, implemented all backend services, frontend components, ML pipeline, and documentation through an iterative conversation-driven development process. The application is a genuine demonstration of Bob as a load-bearing development tool.
