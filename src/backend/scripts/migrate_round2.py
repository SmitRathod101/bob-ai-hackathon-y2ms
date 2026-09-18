"""
Round 2 DB migration script — adds new columns and tables.
Safe to re-run (idempotent).
"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '..', 'chainmind.db')
db_path = os.path.abspath(db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Add new columns to simulation_runs
columns_to_add = [
    ('simulation_runs', 'mode', 'TEXT DEFAULT "scenario"'),
    ('simulation_runs', 'source_events_json', 'TEXT'),
    ('simulation_runs', 'run_label', 'TEXT'),
]
for table, col, col_type in columns_to_add:
    try:
        cursor.execute(f'ALTER TABLE {table} ADD COLUMN {col} {col_type}')
        print(f'Added column {col} to {table}')
    except sqlite3.OperationalError as e:
        print(f'Skip {col} in {table}: {e}')

conn.commit()
conn.close()
print('Manual migration done.')

# Now create new tables via SQLAlchemy
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.database.session import init_db
init_db()
print('init_db() complete — new tables created if not existing.')
