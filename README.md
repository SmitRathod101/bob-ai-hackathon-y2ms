# ChainMind AI

## AI-Powered Supply Chain Control Center

ChainMind AI is an intelligent supply-chain control center designed to help operations teams monitor logistics networks, detect disruptions, understand their impact, and make faster response decisions.

The system combines a live network view, shipment and route intelligence, disruption detection, AI-assisted analysis, crisis simulation, and what-if analysis into a single operational interface.

---

## 🚨 Problem

Modern supply chains are highly interconnected. A disruption at a port, route, warehouse, or shipment can quickly propagate across the network.

Operations teams need to answer questions such as:

- What is happening in the network right now?
- Which shipments and routes are at risk?
- What will be affected if a disruption occurs?
- How severe is the impact?
- What response options are available?
- How will the network behave under a simulated crisis?

Traditional monitoring systems often provide data without connecting detection, investigation, analysis, and response into one workflow.

---

## 💡 Our Solution

**ChainMind AI** provides a unified control-center experience following the operational workflow:

> **MONITOR → INVESTIGATE → ANALYZE → DECIDE → ACT**

### Monitor
View the overall health of the supply-chain network through operational KPIs, shipments, routes, ports, fleet status, and active risks.

### Investigate
Select shipments, routes, disruptions, and network elements to inspect their operational details and understand what is happening.

### Analyze
Use AI-assisted analysis to understand disruption impact, affected network elements, and potential response considerations.

### Decide
Review available information and AI-assisted recommendations before taking an operational decision.

### Act
Use supported simulation and operational workflows to evaluate or execute the available response actions.

---

# 🚀 Key Features

## 1. Operations Control Center

The Overview dashboard provides a centralized view of the supply-chain network.

It includes:

- Network health
- Active risks
- Shipment status
- Port network
- Fleet status
- Active disruptions
- Digital Twin network visualization
- Operational KPIs

---

## 2. Digital Twin

ChainMind provides a visual representation of the logistics network, allowing users to understand relationships between network elements.

The Digital Twin helps visualize:

- Ports
- Routes
- Network nodes
- Fleet activity
- Disruption states
- Network conditions

Users can interact with relevant network elements to investigate operational details.

---

## 3. Disruption Intelligence

Disruptions can be investigated through a dedicated disruption workflow.

Users can:

- Identify active disruptions
- Inspect disruption details
- Understand affected routes and shipments
- Analyze potential impact
- Review AI-assisted analysis
- Navigate toward available response workflows

---

## 4. AI-Assisted Analysis

ChainMind integrates AI-assisted reasoning into the operational workflow.

The system helps users understand:

- Why a disruption matters
- Which network elements may be affected
- Potential operational consequences
- Response considerations
- Recommended next steps where supported

The goal is to help operations teams move from raw operational data toward actionable understanding.

---

## 5. Crisis Simulator

The Crisis Simulator allows users to test how the supply-chain network reacts to disruption scenarios.

Users can:

1. Configure a crisis scenario
2. Start the simulation
3. Monitor simulation cycles
4. Observe detected crises
5. Inspect affected network elements
6. Review the resulting operational state
7. Continue or stop the simulation

This provides a controlled environment for testing network resilience.

---

## 6. Manual Mode

Manual Mode allows operators to control and test crisis scenarios directly.

It provides an operational workflow for:

- Selecting a crisis scenario
- Configuring simulation parameters
- Triggering a disruption
- Monitoring its effects
- Inspecting the resulting network state

---

## 7. What-If Analysis

What-If Analysis allows users to explore potential disruption scenarios before making operational decisions.

This helps answer questions such as:

> "What happens to the network if this disruption occurs?"

The purpose is to support planning, resilience analysis, and operational decision-making.

---

## 8. Shipments & Network Intelligence

ChainMind provides dedicated views for operational network data.

Users can inspect:

- Shipments
- Routes
- Network connections
- Operational status
- Risk indicators
- Disruption information

The system connects these views with the broader control-center workflow.

---

# 🎯 Intended Users

ChainMind is designed for:

- Supply Chain Managers
- Control Tower / Operations Managers
- Logistics Managers and Planners
- Risk & Resilience Teams
- Dispatchers and Fleet Operators
- Supply Chain Operations Teams

### Primary User

> **A Supply Chain Control Tower / Operations Manager responsible for monitoring the logistics network, detecting disruptions, understanding their impact, and deciding how to respond.**

---

# 🧠 Why ChainMind?

ChainMind is designed around the operational decision-making process rather than simply displaying supply-chain data.

Instead of forcing an operator to move between disconnected systems, ChainMind brings together:

**Network Monitoring**

↓

**Risk Detection**

↓

**Disruption Investigation**

↓

**AI-Assisted Analysis**

↓

**Crisis Simulation**

↓

**Operational Decision Support**

This creates a single workflow for understanding and responding to supply-chain disruptions.

---

# 🖥️ Demo

### Live Demo

**ChainMind AI:**  
https://bob-ai-hackathon-y2ms-pngqxe9fu-smitrathod101.vercel.app/

---

# 🎬 Suggested Demo Flow

The recommended demonstration follows a realistic control-center workflow:

1. Open the **Overview**
2. Show network health and operational KPIs
3. Show the **Digital Twin**
4. Inspect active risks
5. Open a shipment, route, or disruption
6. Investigate the disruption
7. Open AI-assisted analysis
8. Review the available response information
9. Open **Crisis Simulator**
10. Configure a crisis scenario
11. Start the simulation
12. Monitor simulation cycles
13. Observe affected network elements
14. Review the resulting operational state
15. Use **Manual Mode** or **What-If Analysis** to explore additional scenarios

---

# 🏗️ Architecture

```text
                    ┌───────────────────────┐
                    │      ChainMind AI     │
                    │   Control Center UI   │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │      React + Vite     │
                    │      TypeScript       │
                    └───────────┬───────────┘
                                │
                           REST APIs
                                │
                                ▼
                    ┌───────────────────────┐
                    │     FastAPI Backend   │
                    │      Python           │
                    └───────────┬───────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
          ┌──────────┐   ┌────────────┐   ┌────────────┐
          │ SQLite   │   │ Simulation │   │ AI / ML    │
          │ Database │   │ Engine     │   │ Analysis   │
          └──────────┘   └────────────┘   └────────────┘