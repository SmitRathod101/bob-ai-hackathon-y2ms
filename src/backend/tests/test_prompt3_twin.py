"""
Prompt 3 Digital Twin API Tests — ChainMind AI
Tests the /api/twin/state endpoint and core Digital Twin functionality.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestDigitalTwinEndpoint:
    """Test the /api/twin/state Digital Twin state endpoint."""

    def test_twin_state_returns_200(self):
        """Twin state endpoint responds successfully."""
        resp = client.get("/api/twin/state")
        assert resp.status_code == 200

    def test_twin_state_has_required_fields(self):
        """Twin state response includes all required top-level fields."""
        resp = client.get("/api/twin/state")
        data = resp.json()

        assert "nodes" in data
        assert "connections" in data
        assert "shipments" in data
        assert "simulation" in data
        assert "auto_mode" in data
        assert "network_health" in data
        assert "stats" in data

    def test_twin_nodes_have_coordinates(self):
        """Each node includes lat/lon for map projection."""
        resp = client.get("/api/twin/state")
        data = resp.json()

        for node in data["nodes"]:
            assert "lat" in node, f"Node {node.get('name')} missing lat"
            assert "lon" in node, f"Node {node.get('name')} missing lon"
            assert node["lat"] != 0 or node["lon"] != 0, f"Node {node.get('name')} has zero coordinates"

    def test_twin_connections_have_status(self):
        """Each connection has a status field."""
        resp = client.get("/api/twin/state")
        data = resp.json()

        for conn in data["connections"]:
            assert "status" in conn, f"Connection {conn.get('id')} missing status"
            assert conn["status"] in ("available", "degraded", "unavailable"), \
                f"Unexpected status: {conn['status']}"

    def test_twin_shipments_have_risk(self):
        """Each shipment includes risk_score and risk_level."""
        resp = client.get("/api/twin/state")
        data = resp.json()

        for shipment in data["shipments"]:
            assert "risk_score" in shipment
            assert "risk_level" in shipment
            assert shipment["risk_level"] in ("low", "medium", "high", "critical")

    def test_twin_network_health_valid(self):
        """Network health is one of the expected states."""
        resp = client.get("/api/twin/state")
        data = resp.json()

        assert data["network_health"] in (
            "normal", "warning", "crisis", "recovery", "recovered"
        )

    def test_twin_stats_consistent(self):
        """Stats counts are consistent with actual data arrays."""
        resp = client.get("/api/twin/state")
        data = resp.json()

        stats = data["stats"]
        # Total shipments in stats matches shipments array length
        assert stats["total_shipments"] == len(data["shipments"])
        # Total nodes in stats matches nodes array length
        assert stats["total_nodes"] == len(data["nodes"])

    def test_twin_auto_mode_state(self):
        """Auto mode state has expected fields."""
        resp = client.get("/api/twin/state")
        data = resp.json()

        am = data["auto_mode"]
        assert "status" in am
        assert "phase" in am
        assert am["status"] in ("idle", "running", "paused")

    def test_twin_simulation_state_structure(self):
        """Simulation state has expected structure."""
        resp = client.get("/api/twin/state")
        data = resp.json()

        sim = data["simulation"]
        assert "active" in sim
        assert isinstance(sim["active"], bool)
