import { useState, useEffect, useCallback, useRef } from 'react';

const BASE_URL = '/api';

export function useStadiumData(pollInterval = 3000) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/stadium/state`);
      if (!res.ok) throw new Error('Failed to fetch state');
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    intervalRef.current = setInterval(fetchState, pollInterval);
    return () => clearInterval(intervalRef.current);
  }, [fetchState, pollInterval]);

  return { state, loading, error, refetch: fetchState };
}

export function useAutoAnalysis(pollInterval = 10000) {
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${BASE_URL}/agent/auto-analyze`);
        const data = await res.json();
        setAnalysis(data);
      } catch (e) { /* silent */ }
    };
    fetch_();
    const id = setInterval(fetch_, pollInterval);
    return () => clearInterval(id);
  }, [pollInterval]);

  return analysis;
}

export async function sendAgentQuery(message) {
  const res = await fetch(`${BASE_URL}/agent/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json();
    return { response: err.fallback || err.error || 'Error processing request', toolsUsed: [] };
  }
  return res.json();
}

export async function updateMatchStatus(status) {
  const res = await fetch(`${BASE_URL}/stadium/match-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return res.json();
}

export async function updateGateStatus(gateId, status) {
  const res = await fetch(`${BASE_URL}/stadium/gate/${gateId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return res.json();
}

export async function resolveIncident(incidentId) {
  const res = await fetch(`${BASE_URL}/stadium/incidents/${incidentId}/resolve`, {
    method: 'POST',
  });
  return res.json();
}
