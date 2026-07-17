/**
 * @file stadium.js
 * @description Stadium state routes: read the live state, gates, zones,
 * incidents, and alerts; and mutate match status, gates, incidents, and reset.
 * @module routes/stadium
 */

import express from "express";
import { v4 as uuidv4 } from "uuid";
import { authMiddleware } from "../auth.js";
import { stadiumState, addAlert, resetStadiumState } from "../state.js";
import { saveStadiumState } from "../../db.js";

const router = express.Router();

// Reset simulation state
/**
 * POST /api/stadium/reset
 *
 * Purpose: Resets the entire stadium simulation state to default baseline values.
 * Authentication: Bearer JWT token required in Authorization header.
 * Request Body Shape: None.
 * Response JSON (200 OK):
 *   - success {boolean} - Indicates whether the reset succeeded.
 *   - message {string} - Success feedback message.
 * Status Codes:
 *   - 200 OK: Reset complete.
 *   - 401 Unauthorized: Invalid or missing token.
 */
router.post("/api/stadium/reset", authMiddleware, (_req, res) => {
  resetStadiumState();
  res.json({ success: true, message: "Simulation state reset successfully." });
});

// Get full stadium state
/**
 * GET /api/stadium/state
 *
 * Purpose: Retrieves the full current stadium state excluding full history, but with a recent history subset.
 * Request Parameters: None.
 * Request Body Shape: None.
 * Response JSON (200 OK):
 *   - name {string} - Name of the stadium.
 *   - capacity {number} - Total capacity of the stadium.
 *   - currentOccupancy {number} - Current occupancy count.
 *   - utilizationPercent {string} - Occupancy percentage formatted as string.
 *   - matchStatus {string} - Current match status.
 *   - weatherCondition {string} - Current weather description.
 *   - temperature {number} - Temperature in Celsius.
 *   - humidity {number} - Humidity percentage.
 *   - gates {Object} - Map of gate states.
 *   - zones {Object} - Map of zone states.
 *   - incidents {Array} - List of active/recent incidents.
 *   - alerts {Array} - List of system alerts.
 *   - routingDecisions {Array} - List of routing decisions.
 *   - activeIncidents {number} - Count of current active incidents.
 *   - crowdHistory {Array} - Recent 60 data points of crowd history.
 * Status Codes:
 *   - 200 OK: Successfully retrieved stadium state.
 */
router.get("/api/stadium/state", (_req, res) => {
  const { crowdHistory: _, ...stateWithoutHistory } = stadiumState;
  res.json({
    ...stateWithoutHistory,
    currentOccupancy: stadiumState.currentOccupancy,
    utilizationPercent: ((stadiumState.currentOccupancy / stadiumState.capacity) * 100).toFixed(1),
    activeIncidents: stadiumState.incidents.filter((i) => i.status === "active").length,
    crowdHistory: stadiumState.crowdHistory.slice(-60),
  });
});

// Get gates
/**
 * GET /api/stadium/gates
 *
 * Purpose: Retrieves only the current gates state.
 * Request Parameters: None.
 * Request Body Shape: None.
 * Response JSON (200 OK):
 *   - gates {Object} - Map of gate IDs to their current status, queue length, flow, and details.
 * Status Codes:
 *   - 200 OK: Successfully retrieved gates status.
 */
router.get("/api/stadium/gates", (_req, res) => {
  res.json({ gates: stadiumState.gates });
});

// Get zones
/**
 * GET /api/stadium/zones
 *
 * Purpose: Retrieves only the current zones state.
 * Request Parameters: None.
 * Request Body Shape: None.
 * Response JSON (200 OK):
 *   - zones {Object} - Map of zone names to their capacity, occupancy, density, and risk level.
 * Status Codes:
 *   - 200 OK: Successfully retrieved zones status.
 */
router.get("/api/stadium/zones", (_req, res) => {
  res.json({ zones: stadiumState.zones });
});

// Get incidents
/**
 * GET /api/stadium/incidents
 *
 * Purpose: Retrieves the most recent 20 incidents.
 * Request Parameters: None.
 * Request Body Shape: None.
 * Response JSON (200 OK):
 *   - incidents {Array} - Array of recent incident objects.
 * Status Codes:
 *   - 200 OK: Successfully retrieved incidents.
 */
router.get("/api/stadium/incidents", (_req, res) => {
  res.json({ incidents: stadiumState.incidents.slice(0, 20) });
});

// Get alerts
/**
 * GET /api/stadium/alerts
 *
 * Purpose: Retrieves the most recent 30 system alerts.
 * Request Parameters: None.
 * Request Body Shape: None.
 * Response JSON (200 OK):
 *   - alerts {Array} - Array of recent system alerts.
 * Status Codes:
 *   - 200 OK: Successfully retrieved alerts.
 */
router.get("/api/stadium/alerts", (_req, res) => {
  res.json({ alerts: stadiumState.alerts.slice(0, 30) });
});

// Update match status
/**
 * POST /api/stadium/match-status
 *
 * Purpose: Updates the match status and triggers an alert.
 * Authentication: Bearer JWT token required in Authorization header.
 * Request Body Shape:
 *   - status {string} - The new match status ("pre-match", "ongoing", "break", "post-match", "emergency").
 * Response JSON (200 OK):
 *   - success {boolean} - True if operation succeeded.
 *   - matchStatus {string} - The updated match status.
 * Response JSON (400 Bad Request):
 *   - error {string} - Error message details.
 * Status Codes:
 *   - 200 OK: Status updated successfully.
 *   - 400 Bad Request: Invalid or unsupported match status value.
 *   - 401 Unauthorized: Invalid or missing token.
 */
router.post("/api/stadium/match-status", authMiddleware, (req, res) => {
  const { status } = req.body;
  const validStatuses = ["pre-match", "ongoing", "break", "post-match", "emergency"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid match status" });
  }
  stadiumState.matchStatus = status;
  addAlert({
    id: uuidv4(),
    type: "status_change",
    message: `Match status changed to: ${status.toUpperCase()}`,
    timestamp: Date.now(),
    severity: "medium",
  });
  saveStadiumState(stadiumState);
  res.json({ success: true, matchStatus: status });
});

// Manual gate control
/**
 * POST /api/stadium/gate/:gateId
 *
 * Purpose: Manually overrides the status of a specific gate.
 * Authentication: Bearer JWT token required in Authorization header.
 * Request Parameters:
 *   - gateId {string} - The ID of the gate to control.
 * Request Body Shape:
 *   - status {string} - The new gate status ("open", "closed", "restricted", "exit_only").
 * Response JSON (200 OK):
 *   - success {boolean} - True if operation succeeded.
 *   - gate {Object} - The updated gate object.
 * Response JSON (400 Bad Request / 404 Not Found):
 *   - error {string} - Error message details.
 * Status Codes:
 *   - 200 OK: Gate status updated successfully.
 *   - 400 Bad Request: Invalid status value.
 *   - 401 Unauthorized: Invalid or missing token.
 *   - 404 Not Found: Gate ID does not exist.
 */
router.post("/api/stadium/gate/:gateId", authMiddleware, (req, res) => {
  const { gateId } = req.params;
  const { status } = req.body;

  const validStatuses = ["open", "closed", "restricted", "exit_only"];
  if (!validStatuses.includes(status)) {
    return res
      .status(400)
      .json({ error: "Invalid status. Allowed values are: open, closed, restricted, exit_only." });
  }

  const gate = stadiumState.gates[gateId];
  if (!gate) return res.status(404).json({ error: "Gate not found" });
  gate.status = status;
  saveStadiumState(stadiumState);
  res.json({ success: true, gate });
});

// Resolve incident
/**
 * POST /api/stadium/incidents/:incidentId/resolve
 *
 * Purpose: Marks a specific active incident as resolved.
 * Authentication: Bearer JWT token required in Authorization header.
 * Request Parameters:
 *   - incidentId {string} - The ID of the incident to resolve.
 * Request Body Shape: None.
 * Response JSON (200 OK):
 *   - success {boolean} - True if operation succeeded.
 *   - incident {Object} - The updated and resolved incident object.
 * Response JSON (404 Not Found):
 *   - error {string} - Error message details.
 * Status Codes:
 *   - 200 OK: Incident resolved successfully.
 *   - 401 Unauthorized: Invalid or missing token.
 *   - 404 Not Found: Incident ID does not exist.
 */
router.post("/api/stadium/incidents/:incidentId/resolve", authMiddleware, (req, res) => {
  const incident = stadiumState.incidents.find((i) => i.id === req.params.incidentId);
  if (!incident) return res.status(404).json({ error: "Incident not found" });
  incident.status = "resolved";
  saveStadiumState(stadiumState);
  res.json({ success: true, incident });
});

export default router;
