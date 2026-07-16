/**
 * @file useStadiumData.js
 * @description Provides react hooks and helper functions for accessing stadium data,
 * managing real-time data polling, sending agent queries, and updating stadium/gate/incident state.
 */

import { useState, useEffect, useCallback } from "react";

const BASE_URL = "/api";

/**
 * Retrieves authentication headers for API requests.
 * Reads the token from the current session in localStorage.
 *
 * @returns {Object} The header object containing Content-Type and optionally Authorization.
 */
function getAuthHeaders() {
  try {
    const sessionStr = localStorage.getItem("crowdpulse_session");
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      if (session && session.token) {
        return {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        };
      }
    }
  } catch (e) {
    console.error("Error reading session for auth headers", e);
  }
  return { "Content-Type": "application/json" };
}

/**
 * Manages periodic polling of stadium state and automated AI analysis data.
 * Maintains subscription listeners to trigger UI updates.
 */
class PollingManager {
  /**
   * Initializes the PollingManager instance.
   */
  constructor() {
    /** @type {Set<Function>} List of listener callbacks */
    this.listeners = new Set();
    /** @type {Object|null} Cached stadium state data */
    this.state = null;
    /** @type {boolean} State loading indicator */
    this.loading = true;
    /** @type {string|null} Error message from failed state fetches */
    this.error = null;
    /** @type {Object|null} Cached AI automated analysis data */
    this.analysis = null;
    /** @type {number|null} Interval timer ID */
    this.timer = null;
    /** @type {number} Counter of seconds elapsed for polling coordination */
    this.tick = 0;
  }

  /**
   * Adds a subscriber listener and starts polling if not already started.
   *
   * @param {Function} listener - Callback function invoked on state changes.
   */
  addListener(listener) {
    this.listeners.add(listener);
    if (!this.timer) {
      this.start();
    }
  }

  /**
   * Removes a subscriber listener and stops polling if no active listeners remain.
   *
   * @param {Function} listener - Callback function to remove.
   */
  removeListener(listener) {
    this.listeners.delete(listener);
    if (this.listeners.size === 0) {
      this.stop();
    }
  }

  /**
   * Notifies all subscribed listeners of changes.
   */
  notify() {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Fetches the current stadium state from the backend.
   * Updates state/error/loading and triggers notification.
   *
   * @returns {Promise<void>}
   */
  async fetchState() {
    try {
      const res = await fetch(`${BASE_URL}/stadium/state`);
      if (!res.ok) throw new Error("Failed to fetch state");
      const data = await res.json();
      this.state = data;
      this.error = null;
    } catch (err) {
      this.error = err.message;
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  /**
   * Fetches the latest AI auto-analysis from the backend.
   * Updates analysis and triggers notification.
   *
   * @returns {Promise<void>}
   */
  async fetchAnalysis() {
    try {
      const res = await fetch(`${BASE_URL}/agent/auto-analyze`);
      if (res.ok) {
        const data = await res.json();
        this.analysis = data;
      }
    } catch (e) {
      // silent
    } finally {
      this.notify();
    }
  }

  /**
   * Starts the polling timer, executing immediate initial fetches.
   */
  start() {
    // Execute initial fetches immediately to populate cache without waiting for the first tick
    this.fetchState();
    this.fetchAnalysis();

    // Set up a 1-second interval to coordinate multiplexed polling
    this.timer = setInterval(() => {
      // Increment elapsed ticks (seconds)
      this.tick += 1;
      
      // Fetch general stadium telemetry every 3 seconds (when tick is a multiple of 3)
      if (this.tick % 3 === 0) {
        this.fetchState();
      }
      
      // Fetch automated AI analysis report every 8 seconds (when tick is a multiple of 8)
      if (this.tick % 8 === 0) {
        this.fetchAnalysis();
      }
    }, 1000);
  }

  /**
   * Stops the polling timer and resets the tick counter.
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Reset elapsed ticks to restart clean next time polling starts
    this.tick = 0;
  }
}

const manager = new PollingManager();

/**
 * Custom React hook to subscribe to and fetch the stadium status data.
 *
 * @returns {Object} An object containing the stadium state, loading status, error message, and a refetch function.
 */
export function useStadiumData() {
  const [data, setData] = useState({
    state: manager.state,
    loading: manager.loading,
    error: manager.error,
  });

  useEffect(() => {
    const handleUpdate = () => {
      setData({
        state: manager.state,
        loading: manager.loading,
        error: manager.error,
      });
    };
    manager.addListener(handleUpdate);
    return () => {
      manager.removeListener(handleUpdate);
    };
  }, []);

  const refetch = useCallback(() => {
    manager.fetchState();
  }, []);

  return { ...data, refetch };
}

/**
 * Custom React hook to subscribe to and fetch automated AI analysis updates.
 *
 * @returns {Object|null} The latest AI analysis details or null if not loaded.
 */
export function useAutoAnalysis() {
  const [analysis, setAnalysis] = useState(manager.analysis);

  useEffect(() => {
    const handleUpdate = () => {
      setAnalysis(manager.analysis);
    };
    manager.addListener(handleUpdate);
    return () => {
      manager.removeListener(handleUpdate);
    };
  }, []);

  return analysis;
}

/**
 * Submits a natural language command or question to the AI Agent.
 *
 * @param {string} message - The query message to send to the agent.
 * @returns {Promise<Object>} A promise resolving to the agent response and tools used details.
 */
export async function sendAgentQuery(message) {
  const res = await fetch(`${BASE_URL}/agent/query`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json();
    return { response: err.fallback || err.error || "Error processing request", toolsUsed: [] };
  }
  return res.json();
}

/**
 * Updates the overall status of the match (e.g., Active, Suspended).
 *
 * @param {string} status - The new match status.
 * @returns {Promise<Object>} A promise resolving to the response from the server.
 */
export async function updateMatchStatus(status) {
  const res = await fetch(`${BASE_URL}/stadium/match-status`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  return res.json();
}

/**
 * Updates the status of a specific stadium gate.
 *
 * @param {string|number} gateId - The unique identifier of the gate.
 * @param {string} status - The new gate status (e.g., Open, Closed, Lock Down).
 * @returns {Promise<Object>} A promise resolving to the response from the server.
 */
export async function updateGateStatus(gateId, status) {
  const res = await fetch(`${BASE_URL}/stadium/gate/${gateId}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  return res.json();
}

/**
 * Marks a specific incident as resolved.
 *
 * @param {string|number} incidentId - The unique identifier of the incident to resolve.
 * @returns {Promise<Object>} A promise resolving to the response from the server.
 */
export async function resolveIncident(incidentId) {
  const res = await fetch(`${BASE_URL}/stadium/incidents/${incidentId}/resolve`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return res.json();
}

