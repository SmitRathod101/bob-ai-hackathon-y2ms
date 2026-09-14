import sys
sys.path.insert(0, '.')

from app.database.session import SessionLocal, init_db
from app.simulation.engine import run_simulation

init_db()
db = SessionLocal()

# Test 72h scenario
scenario_72 = {'disruption_type': 'port_closure', 'location': 'Mumbai Port', 'duration_hours': 72, 'severity': 'high', 'capacity_reduction': 1.0}
result_72 = run_simulation(db, scenario_72)
imp = result_72['impact_summary']
rec = result_72['recommended_strategy']

print('=== 72h Simulation ===')
print('Affected:', imp['total_affected_shipments'])
print('Cargo (Cr):', round(imp['total_cargo_value_exposed'] / 1e7, 2))
print('Avg delay (h):', round(imp['average_delay_hours'], 1))
print('Cold-chain at risk:', imp['cold_chain_at_risk'])
print('Strategies:', [s['strategy_type'] for s in result_72['strategies']])
print('Recommended:', rec['strategy_type'])
print('Recovery cost (Cr):', round(rec['additional_cost_inr'] / 1e7, 2))

# Test 120h scenario
scenario_120 = {'disruption_type': 'port_closure', 'location': 'Mumbai Port', 'duration_hours': 120, 'severity': 'high', 'capacity_reduction': 1.0}
result_120 = run_simulation(db, scenario_120)
imp120 = result_120['impact_summary']
rec120 = result_120['recommended_strategy']

print()
print('=== 120h Simulation ===')
print('Avg delay (h):', round(imp120['average_delay_hours'], 1))
delay_pct = (imp120['average_delay_hours'] - imp['average_delay_hours']) / max(imp['average_delay_hours'], 1) * 100
print('Delay increase: +' + str(round(delay_pct, 1)) + '%')
print('Recommended:', rec120['strategy_type'])

print()
print('=== Validation ===')
results_change = imp120['average_delay_hours'] > imp['average_delay_hours']
print('Results change 72h->120h:', 'PASS' if results_change else 'FAIL')
strategies_present = len(result_72['strategies']) >= 3
print('3 strategies generated:', 'PASS' if strategies_present else 'FAIL')
cold_chain_tracked = imp['cold_chain_at_risk'] > 0
print('Cold-chain tracked:', 'PASS' if cold_chain_tracked else 'FAIL')

db.close()
