import { useState, useEffect, useCallback } from "react";

const BASE_URL = "/api";

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

class PollingManager {
  constructor() {
    this.listeners = new Set();
    this.state = null;
    this.loading = true;
    this.error = null;
    this.analysis = null;
    this.timer = null;
    this.tick = 0;
  }

  addListener(listener) {
    this.listeners.add(listener);
    if (!this.timer) {
      this.start();
    }
  }

  removeListener(listener) {
    this.listeners.delete(listener);
    if (this.listeners.size === 0) {
      this.stop();
    }
  }

  notify() {
    this.listeners.forEach((listener) => listener());
  }

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

  start() {
    // Initial fetch immediately
    this.fetchState();
    this.fetchAnalysis();

    this.timer = setInterval(() => {
      this.tick += 1;
      // Fetch stadium state every 3 seconds (3 ticks)
      if (this.tick % 3 === 0) {
        this.fetchState();
      }
      // Fetch auto-analysis every 8 seconds (8 ticks)
      if (this.tick % 8 === 0) {
        this.fetchAnalysis();
      }
    }, 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.tick = 0;
  }
}

const manager = new PollingManager();

export function useStadiumData(_pollInterval = 3000) {
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

export function useAutoAnalysis(_pollInterval = 10000) {
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

export async function updateMatchStatus(status) {
  const res = await fetch(`${BASE_URL}/stadium/match-status`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  return res.json();
}

export async function updateGateStatus(gateId, status) {
  const res = await fetch(`${BASE_URL}/stadium/gate/${gateId}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  return res.json();
}

export async function resolveIncident(incidentId) {
  const res = await fetch(`${BASE_URL}/stadium/incidents/${incidentId}/resolve`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return res.json();
}
