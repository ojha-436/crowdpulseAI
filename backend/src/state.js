/**
 * @file state.js
 * @description Shared mutable stadium state. Exposes the singleton `stadiumState`
 * object (mutated in place so every importer sees the same reference), helpers to
 * initialise/reset it, and an async loader that hydrates it from the database.
 * @module state
 */

import { SIM } from "./config.js";
import { getStadiumState, saveStadiumState } from "../db.js";

/**
 * Generates the initial, baseline state for the stadium.
 * Contains mock data for gates, zones, weather, and incidents.
 * @returns {Object} The default stadium state.
 */
export const getInitialState = () => {
  const state = {
    name: "Narendra Modi Stadium, Ahmedabad",
    capacity: 132000,
    currentOccupancy: 0,
    matchStatus: "pre-match",
    weatherCondition: "clear",
    temperature: 34,
    humidity: 62,
    gates: {},
    zones: {},
    incidents: [],
    alerts: [],
    crowdHistory: [],
    routingDecisions: [],
  };

  const gateNames = [
    "North-A",
    "North-B",
    "North-C",
    "East-A",
    "East-B",
    "East-C",
    "South-A",
    "South-B",
    "South-C",
    "West-A",
    "West-B",
    "West-C",
  ];

  gateNames.forEach((name) => {
    state.gates[name] = {
      id: name,
      status: "open",
      currentFlow: 0,
      maxCapacity: 3200,
      currentLoad: 0,
      queueLength: 0,
      avgProcessingTime: 8,
      direction: name.split("-")[0],
      scanners: 6,
      activeScanners: 6,
    };
  });

  const zoneNames = [
    "North Stand",
    "East Pavilion",
    "South Stand",
    "West Pavilion",
    "VIP Lounge",
    "Corporate Box",
    "General-Upper",
    "General-Lower",
  ];
  zoneNames.forEach((name) => {
    const cap = name.includes("VIP") ? 5000 : name.includes("Corporate") ? 3000 : 18000;
    state.zones[name] = {
      id: name,
      capacity: cap,
      currentOccupancy: 0,
      density: 0,
      riskLevel: "low",
      temperature: 34 + Math.random() * 3,
      exitRoutes: 4,
      facilities: { water: "operational", medical: "standby", restrooms: "operational" },
    };
  });

  return state;
};

/**
 * The shared, mutable stadium state singleton. Other modules import this exact
 * reference and mutate it in place; it is never reassigned.
 * @type {Object}
 */
export const stadiumState = getInitialState();

/**
 * Adds an alert to the stadium state's alert history.
 * Maintains a maximum history size of 50 alerts.
 * @param {Object} alert - The alert object to add.
 */
export function addAlert(alert) {
  stadiumState.alerts.unshift(alert);
  if (stadiumState.alerts.length > SIM.MAX_ALERT_HISTORY) {
    stadiumState.alerts = stadiumState.alerts.slice(0, SIM.MAX_ALERT_HISTORY);
  }
}

/**
 * Loads persisted stadium state from the database on startup and merges it into
 * the shared singleton, trimming the alert history to its cap. Exposed as an
 * explicit call (rather than running at import time) so server.js controls when
 * the load happens.
 * @returns {Promise<void>}
 */
export async function initStateFromDb() {
  const dbState = await getStadiumState(stadiumState);
  Object.assign(stadiumState, dbState);
  if (stadiumState.alerts.length > SIM.MAX_ALERT_HISTORY) {
    stadiumState.alerts = stadiumState.alerts.slice(0, SIM.MAX_ALERT_HISTORY);
  }
}

/**
 * Resets the stadium state to its initial default state and saves it.
 */
export function resetStadiumState() {
  const freshState = getInitialState();
  Object.assign(stadiumState, freshState);
  saveStadiumState(stadiumState);
}
