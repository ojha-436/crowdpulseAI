/**
 * @file simulation.js
 * @description Real-time crowd simulation engine. Advances the shared stadium
 * state on a fixed interval, updating gate flow, zone density, incidents, and
 * weather, then persisting the result.
 * @module simulation
 */

import { v4 as uuidv4 } from "uuid";
import { SIM } from "./config.js";
import { stadiumState } from "./state.js";
import { saveStadiumState } from "../db.js";

/**
 * Counter for the number of simulation ticks executed.
 * @type {number}
 */
let tickCount = 0;

/**
 * Main simulation loop tick. Updates crowd flow, zone densities,
 * generates random incidents, and triggers weather changes.
 * Executes periodically to simulate real-time stadium dynamics.
 */
export function simulateTick() {
  // Increment global simulation ticks count
  tickCount++;
  const { matchStatus, gates, zones } = stadiumState;

  // 1. Calculate crowd flow multiplier based on the current match phase.
  // Pre-match causes high inward flow (1.2), ongoing has minimal flow (0.1),
  // halftime break increases flow (0.4), and post-match causes high outward flow (-1.5).
  const flowMultiplier =
    matchStatus === "pre-match"
      ? 1.2
      : matchStatus === "ongoing"
        ? 0.1
        : matchStatus === "break"
          ? 0.4
          : matchStatus === "post-match"
            ? -1.5
            : 0;

  let totalOccupancy = 0;

  // 2. Iterate through each gate to update queue length, flow rate, and load.
  Object.values(gates).forEach((gate) => {
    if (gate.status === "open") {
      // Simulate random baseline flow and apply current flow multiplier
      const baseFlow = Math.floor(Math.random() * 80 + 40);
      gate.currentFlow = Math.max(0, Math.floor(baseFlow * Math.abs(flowMultiplier)));

      // Simulate fluctuations in queue length
      gate.queueLength = Math.max(0, gate.queueLength + Math.floor(Math.random() * 20 - 8));

      // Update cumulative load for the gate (inward or outward flow)
      gate.currentLoad = Math.min(
        gate.maxCapacity,
        gate.currentLoad + (flowMultiplier > 0 ? gate.currentFlow : -gate.currentFlow)
      );
      gate.currentLoad = Math.max(0, gate.currentLoad);

      // Calculate randomized average processing time in seconds
      gate.avgProcessingTime = 5 + Math.random() * 10;
    } else {
      // Non-open gates have no flow passing through
      gate.currentFlow = 0;
    }
  });

  // 3. Iterate through each zone to update occupancies and compute safety/congestion risk levels.
  Object.values(zones).forEach((zone) => {
    // Generate simulated inflow of fans based on current flow multiplier
    const inflow = Math.floor(Math.random() * 200 * Math.abs(flowMultiplier));
    if (flowMultiplier > 0) {
      zone.currentOccupancy = Math.min(zone.capacity, zone.currentOccupancy + inflow);
    } else {
      zone.currentOccupancy = Math.max(0, zone.currentOccupancy - inflow);
    }

    // Calculate density as ratio of current occupancy to maximum capacity
    zone.density = zone.currentOccupancy / zone.capacity;

    // Determine risk level based on standard density thresholds
    zone.riskLevel =
      zone.density > SIM.DENSITY_CRITICAL
        ? "critical"
        : zone.density > SIM.DENSITY_HIGH
          ? "high"
          : zone.density > SIM.DENSITY_MEDIUM
            ? "medium"
            : "low";

    // Update simulated temperature in Celsius
    zone.temperature = 32 + Math.random() * 5;
    totalOccupancy += zone.currentOccupancy;
  });

  stadiumState.currentOccupancy = totalOccupancy;

  // 4. Record current occupancy and tick timestamp to historical data
  stadiumState.crowdHistory.push({
    timestamp: Date.now(),
    occupancy: totalOccupancy,
    tick: tickCount,
  });

  // Cap history size to prevent memory bloat
  if (stadiumState.crowdHistory.length > SIM.MAX_CROWD_HISTORY) stadiumState.crowdHistory.shift();

  // 5. Randomly generate active incidents to simulate operational anomalies
  if (Math.random() < SIM.INCIDENT_SPAWN_CHANCE) {
    const incidentTypes = [
      "medical",
      "security",
      "congestion",
      "equipment_failure",
      "weather_alert",
    ];
    const severity = ["low", "medium", "high", "critical"];
    const zoneKeys = Object.keys(zones);

    const incident = {
      id: uuidv4(),
      type: incidentTypes[Math.floor(Math.random() * incidentTypes.length)],
      severity: severity[Math.floor(Math.random() * severity.length)],
      zone: zoneKeys[Math.floor(Math.random() * zoneKeys.length)],
      timestamp: Date.now(),
      status: "active",
      description: "",
      aiRecommendation: null,
    };
    incident.description = generateIncidentDescription(incident);
    stadiumState.incidents.unshift(incident);

    // Cap active/recent incidents list size
    if (stadiumState.incidents.length > SIM.MAX_INCIDENT_HISTORY) stadiumState.incidents.pop();
  }

  // 6. Fluctuate weather conditions periodically (every 20 ticks by default)
  if (tickCount % SIM.WEATHER_CHANGE_EVERY_TICKS === 0) {
    const conditions = ["clear", "cloudy", "light_rain", "heavy_rain", "storm_warning"];
    stadiumState.weatherCondition = conditions[Math.floor(Math.random() * conditions.length)];
    stadiumState.temperature = 28 + Math.random() * 12;
    stadiumState.humidity = 40 + Math.random() * 50;
  }

  // Save the updated stadium state to db
  saveStadiumState(stadiumState);
}

/**
 * Generates a human-readable description for a given incident based on its type and zone.
 * @param {Object} incident - The incident object containing type and zone.
 * @returns {string} The formatted description string.
 */
export function generateIncidentDescription(incident) {
  const descriptions = {
    medical: `Medical assistance required in ${incident.zone}. Possible heat-related illness reported.`,
    security: `Security concern detected in ${incident.zone}. Unauthorized access attempt at restricted area.`,
    congestion: `Dangerous crowd density building in ${incident.zone}. Flow rate exceeding safe limits.`,
    equipment_failure: `Scanner malfunction at gate near ${incident.zone}. Backup systems activating.`,
    weather_alert: `Weather conditions deteriorating. Wind speed increasing near ${incident.zone} open sections.`,
  };
  return descriptions[incident.type] || "Unclassified incident reported.";
}

/**
 * Starts the real-time simulation engine by setting a periodic interval.
 * Advances the simulation by one tick every SIM.TICK_INTERVAL_MS (3 seconds).
 * @returns {NodeJS.Timeout} The interval timer handle.
 */
export function startSimulation() {
  return setInterval(simulateTick, SIM.TICK_INTERVAL_MS);
}

/**
 * Returns the number of simulation ticks executed so far.
 * @returns {number} The current tick count.
 */
export function getTickCount() {
  return tickCount;
}
