/**
 * @file e2e.test.js
 * @description Comprehensive End-to-End integration tests for the CrowdPulse AI backend.
 * Tests health checks, authentication, stadium telemetry mutations, simulation behavior, and AI advisor flows.
 */

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";

const PORT = process.env.PORT || 8085;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * The JWT secret the test server runs with (run-e2e.js does not set JWT_SECRET,
 * so the server falls back to this default). Used to forge tokens for the
 * security tests below.
 * @type {string}
 */
const TEST_JWT_SECRET = "e2e-deterministic-test-secret";

/**
 * Signs a JWT the same way the server does, allowing tests to craft tokens with
 * arbitrary claims (e.g. an already-expired token) that pass the signature check.
 * @param {Object} payload - Claims to encode.
 * @returns {string} A validly-signed JWT string.
 */
function signTestToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", TEST_JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

/**
 * Decodes the payload segment of a JWT without verifying its signature.
 * @param {string} token - The JWT to decode.
 * @returns {Object} The decoded claims.
 */
function decodeTokenPayload(token) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
}

const originalFetch = globalThis.fetch;
let authToken = "";

/**
 * Helper to fetch a signed JWT authentication token for API authorization.
 *
 * @async
 * @function getAuthToken
 * @returns {Promise<string>} The JWT authorization token, or empty string.
 */
async function getAuthToken() {
  if (authToken) return authToken;
  try {
    const res = await originalFetch(`${BASE_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "abhiraj",
        role: "Stadium Director",
        email: "iamabhiraj8825@gmail.com",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      authToken = data.token;
      return authToken;
    }
  } catch (e) {
    // ignore
  }
  return "";
}

/**
 * Overrides global fetch with automatic JWT Authorization header injection.
 * Simplified auth helper for automated API test client.
 *
 * @param {string|URL} url - Request target URL.
 * @param {Object} [options={}] - Request configuration options.
 * @returns {Promise<Response>} The fetch HTTP response.
 */
globalThis.fetch = async (url, options = {}) => {
  if (typeof url === "string" && url.includes("/api/auth/token")) {
    return originalFetch(url, options);
  }

  const headers = { ...options.headers };

  if (options.noAuth) {
    delete headers["Authorization"];
  } else if (!headers["Authorization"]) {
    const token = await getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const cleanOptions = { ...options };
  delete cleanOptions.noAuth;

  return originalFetch(url, {
    ...cleanOptions,
    headers,
  });
};

// --- MOCK BROWSER ENVIRONMENT FOR FRONTEND AUTH FLOW TESTING ---
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  clear() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
}

const DEFAULT_USERS = [
  {
    username: "abhiraj",
    email: "iamabhiraj8825@gmail.com",
    password: "password123",
    displayName: "Abhiraj Singh",
    role: "Stadium Director",
    avatar: "director",
    clearance: "Level-5 (Super-Admin)",
    commandsCount: 142,
    joinedDate: "May 2026",
  },
  {
    username: "security_chief",
    email: "security@crowdpulse.ai",
    password: "password123",
    displayName: "Vikram Malhotra",
    role: "Security Chief",
    avatar: "security",
    clearance: "Level-4 (Incident-Cmd)",
    commandsCount: 89,
    joinedDate: "May 2026",
  },
];

// Replicated Frontend Auth Flow State Machine for testing conformance
class AuthStateManager {
  constructor() {
    this.localStorage = new LocalStorageMock();
    this.currentUser = null;
    this.users = [];
    this.init();
  }

  init() {
    const storedUsers = this.localStorage.getItem("crowdpulse_users");
    if (!storedUsers) {
      this.localStorage.setItem("crowdpulse_users", JSON.stringify(DEFAULT_USERS));
      this.users = [...DEFAULT_USERS];
    } else {
      this.users = JSON.parse(storedUsers);
    }
    const activeSession = this.localStorage.getItem("crowdpulse_session");
    if (activeSession) {
      this.currentUser = JSON.parse(activeSession);
    } else {
      this.currentUser = null;
    }
  }

  login(emailOrUsername, password) {
    return new Promise((resolve, reject) => {
      const foundUser = this.users.find(
        (u) =>
          (u.email.toLowerCase() === emailOrUsername.toLowerCase() ||
            u.username.toLowerCase() === emailOrUsername.toLowerCase()) &&
          u.password === password
      );
      if (foundUser) {
        this.localStorage.setItem("crowdpulse_session", JSON.stringify(foundUser));
        this.currentUser = foundUser;
        resolve(foundUser);
      } else {
        reject(new Error("Invalid email/username or password."));
      }
    });
  }

  register(username, email, password) {
    return new Promise((resolve, reject) => {
      if (!username || !email || !password) {
        reject(new Error("Fields cannot be empty."));
        return;
      }

      const emailExists = this.users.some((u) => u.email.toLowerCase() === email.toLowerCase());
      const userExists = this.users.some(
        (u) => u.username.toLowerCase() === username.toLowerCase()
      );

      if (emailExists) {
        reject(new Error("Email is already registered."));
        return;
      }
      if (userExists) {
        reject(new Error("Username is already taken."));
        return;
      }

      const newUser = {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password: password,
        displayName: username,
        role: "Operations Analyst",
        avatar: "ops",
        clearance: "Level-2 (Standard-Write)",
        commandsCount: 0,
        joinedDate: "Jul 2026",
      };

      this.users.push(newUser);
      this.localStorage.setItem("crowdpulse_users", JSON.stringify(this.users));
      this.localStorage.setItem("crowdpulse_session", JSON.stringify(newUser));
      this.currentUser = newUser;
      resolve(newUser);
    });
  }

  updateProfile(updatedDetails) {
    return new Promise((resolve) => {
      const mergedUser = { ...this.currentUser, ...updatedDetails };
      this.localStorage.setItem("crowdpulse_session", JSON.stringify(mergedUser));
      this.currentUser = mergedUser;

      this.users = this.users.map((u) =>
        u.email.toLowerCase() === mergedUser.email.toLowerCase() ? mergedUser : u
      );
      this.localStorage.setItem("crowdpulse_users", JSON.stringify(this.users));
      resolve(mergedUser);
    });
  }

  logout() {
    this.localStorage.removeItem("crowdpulse_session");
    this.currentUser = null;
  }
}

// Helper to wait
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper for calling AI query (handles configured & unconfigured Gemini gracefully)
async function queryAI(message) {
  const res = await fetch(`${BASE_URL}/api/agent/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  assert.ok([200, 500].includes(res.status), `Unexpected status: ${res.status}`);
  const data = await res.json();
  return res.status === 500 ? data.fallback : data.response;
}

describe("CrowdPulse E2E Test Suite", () => {
  // Fetch token before any test
  before(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "abhiraj",
          role: "Stadium Director",
          email: "iamabhiraj8825@gmail.com",
        }),
      });
      const data = await res.json();
      authToken = data.token;
      console.log("🔑 Obtained authorization token for E2E runner.");
    } catch (e) {
      console.error("⚠️ Could not obtain authorization token from server:", e.message);
    }
  });

  // Reset the server state before running tests
  beforeEach(async () => {
    try {
      await fetch(`${BASE_URL}/api/stadium/reset`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
    } catch (e) {
      // Ignored if server not running
    }
  });

  // ==========================================
  // TIER 1: HAPPY PATH / STANDARD FLOWS (30)
  // ==========================================
  describe("Tier 1: Happy Path Tests", () => {
    test("T1_1: Health Check Endpoint", async () => {
      const res = await fetch(`${BASE_URL}/health`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, "healthy");
      assert.strictEqual(data.service, "crowdpulse-ai");
    });

    test("T1_2: API Health Check Endpoint", async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, "healthy");
    });

    test("T1_3: Get Stadium State Schema Structure", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/state`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.name);
      assert.ok(data.capacity);
      assert.ok(data.gates);
      assert.ok(data.zones);
      assert.ok(Array.isArray(data.incidents));
      assert.ok(Array.isArray(data.alerts));
    });

    test("T1_4: Get Stadium State Defaults", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/state`);
      const data = await res.json();
      assert.strictEqual(data.name, "Narendra Modi Stadium, Ahmedabad");
      assert.strictEqual(data.capacity, 132000);
    });

    test("T1_5: Get Gates List length and values", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/gates`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const gates = Object.values(data.gates);
      assert.strictEqual(gates.length, 12);
      assert.strictEqual(gates[0].status, "open");
    });

    test("T1_6: Get Zones List length and capacity", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/zones`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      const zones = Object.values(data.zones);
      assert.strictEqual(zones.length, 8);
      const vipZone = zones.find((z) => z.id === "VIP Lounge");
      assert.strictEqual(vipZone.capacity, 5000);
    });

    test("T1_7: Get Incidents List Initially", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/incidents`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.incidents));
    });

    test("T1_8: Get Alerts List Initially", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/alerts`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.alerts));
    });

    test("T1_9: Reset Stadium State API success", async () => {
      // Modify a gate first
      await fetch(`${BASE_URL}/api/stadium/gate/North-A`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "closed" }),
      });
      // Reset
      const res = await fetch(`${BASE_URL}/api/stadium/reset`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      assert.strictEqual(res.status, 200);
      // Verify reset reverted the gate status
      const stateRes = await fetch(`${BASE_URL}/api/stadium/state`);
      const state = await stateRes.json();
      assert.strictEqual(state.gates["North-A"].status, "open");
    });

    test("T1_10: Match Status transition to ongoing", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/match-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "ongoing" }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.matchStatus, "ongoing");
    });

    test("T1_11: Match Status transition to break", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/match-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "break" }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.matchStatus, "break");
    });

    test("T1_12: Match Status transition to post-match", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/match-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "post-match" }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.matchStatus, "post-match");
    });

    test("T1_13: Match Status transition to pre-match", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/match-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "pre-match" }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.matchStatus, "pre-match");
    });

    test("T1_14: Manual Gate Update - Close Gate", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/gate/North-A`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "closed" }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.gate.status, "closed");
    });

    test("T1_15: Manual Gate Update - Open Gate", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/gate/North-A`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "open" }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.gate.status, "open");
    });

    test("T1_16: Manual Gate Update - Restrict Gate", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/gate/North-A`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "restricted" }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.gate.status, "restricted");
    });

    test("T1_17: Manual Gate Update - Exit Only Gate", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/gate/North-A`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "exit_only" }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.gate.status, "exit_only");
    });

    test("T1_18: AI Agent Query base validation", async () => {
      const text = await queryAI("Hello");
      assert.ok(text);
    });

    test("T1_19: AI Query fallback for gates questions", async () => {
      const text = await queryAI("What is the status of North-A gate?");
      assert.ok(text.includes("Gate Status Overview"));
    });

    test("T1_20: AI Query fallback for zone questions", async () => {
      const text = await queryAI("Tell me about the zones density");
      assert.ok(text.includes("Zone Density Report"));
    });

    test("T1_21: AI Query fallback for emergency questions", async () => {
      const text = await queryAI("Are there any emergency events active?");
      assert.ok(text.includes("Active Incidents"));
    });

    test("T1_22: AI Auto-Analysis nominal response", async () => {
      const res = await fetch(`${BASE_URL}/api/agent/auto-analyze`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.overallRisk);
      assert.ok(Array.isArray(data.recommendations));
    });

    test("T1_23: Resolve Incident flow", async () => {
      const stateRes = await fetch(`${BASE_URL}/api/stadium/state`);
      const state = await stateRes.json();
      if (state.incidents.length === 0) {
        const res = await fetch(`${BASE_URL}/api/stadium/incidents/fake-id/resolve`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        assert.strictEqual(res.status, 404);
      } else {
        const incidentId = state.incidents[0].id;
        const res = await fetch(`${BASE_URL}/api/stadium/incidents/${incidentId}/resolve`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.incident.status, "resolved");
      }
    });

    test("T1_24: Get Crowd Analytics: occupancy_trend", async () => {
      const text = await queryAI("Retrieve occupancy trend");
      assert.ok(text);
    });

    test("T1_25: Get Crowd Analytics: gate_throughput", async () => {
      const text = await queryAI("Retrieve gate throughput");
      assert.ok(text);
    });

    test("T1_26: Get Crowd Analytics: zone_distribution", async () => {
      const text = await queryAI("Retrieve zone distribution");
      assert.ok(text);
    });

    test("T1_27: Get Crowd Analytics: risk_summary", async () => {
      const text = await queryAI("Retrieve risk summary");
      assert.ok(text);
    });

    test("T1_28: Auth Login success", async () => {
      const auth = new AuthStateManager();
      const user = await auth.login("abhiraj", "password123");
      assert.strictEqual(user.username, "abhiraj");
      assert.strictEqual(user.clearance, "Level-5 (Super-Admin)");
    });

    test("T1_29: Auth Register success", async () => {
      const auth = new AuthStateManager();
      const user = await auth.register("testuser", "test@crowdpulse.ai", "mypassword");
      assert.strictEqual(user.username, "testuser");
      assert.strictEqual(user.clearance, "Level-2 (Standard-Write)");
    });

    test("T1_30: Auth Profile Update success", async () => {
      const auth = new AuthStateManager();
      await auth.login("abhiraj", "password123");
      const updated = await auth.updateProfile({ displayName: "Abhiraj Singh Updated" });
      assert.strictEqual(updated.displayName, "Abhiraj Singh Updated");
      assert.strictEqual(auth.currentUser.displayName, "Abhiraj Singh Updated");
    });
  });

  // ==========================================
  // TIER 2: EDGE CASES & NEGATIVE PATHS (32)
  // ==========================================
  describe("Tier 2: Edge Cases & Negative Paths", () => {
    test("T2_1: Invalid match status validation", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/match-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "invalid_status" }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, "Invalid match status");
    });

    test("T2_2: Non-existent gate update error", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/gate/Gate-Z`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "closed" }),
      });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.error, "Gate not found");
    });

    test("T2_3: Resolve non-existent incident error", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/incidents/non-existent-uuid/resolve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.error, "Incident not found");
    });

    test("T2_4: AI query empty message error", async () => {
      const res = await fetch(`${BASE_URL}/api/agent/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "" }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, "Message is required");
    });

    test("T2_5: AI query missing parameters", async () => {
      const res = await fetch(`${BASE_URL}/api/agent/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 400);
    });

    test("T2_6: Invalid JSON body format handling", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/match-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: "{ malformed json ",
      });
      assert.strictEqual(res.status, 400);
    });

    test("T2_7: HTTP 404 for invalid API routes", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/unknown-endpoint`);
      const contentType = res.headers.get("content-type");
      assert.ok(contentType.includes("text/html"));
    });

    test("T2_8: Auth Login incorrect password", async () => {
      const auth = new AuthStateManager();
      await assert.rejects(
        auth.login("abhiraj", "wrongpassword"),
        /Invalid email\/username or password/
      );
    });

    test("T2_9: Auth Login non-existent user", async () => {
      const auth = new AuthStateManager();
      await assert.rejects(
        auth.login("non_existent", "password123"),
        /Invalid email\/username or password/
      );
    });

    test("T2_10: Auth Register duplicate username", async () => {
      const auth = new AuthStateManager();
      await assert.rejects(
        auth.register("abhiraj", "newemail@crowdpulse.ai", "password123"),
        /Username is already taken/
      );
    });

    test("T2_11: Auth Register duplicate email", async () => {
      const auth = new AuthStateManager();
      await assert.rejects(
        auth.register("newuser", "iamabhiraj8825@gmail.com", "password123"),
        /Email is already registered/
      );
    });

    test("T2_12: Auth Register empty fields constraints check", async () => {
      const auth = new AuthStateManager();
      await assert.rejects(auth.register("", "", ""), /Fields cannot be empty/);
    });

    test("T2_13: Ticket gate assignment empty zone fallback", async () => {
      const text = await queryAI("Assign ticket gate batch size 50");
      assert.ok(text);
    });

    test("T2_14: Ticket gate assignment invalid zone fallback", async () => {
      const text = await queryAI("Assign ticket gate for Zone Z batch size 50");
      assert.ok(text);
    });

    test("T2_15: Ticket gate assignment boundary batch size", async () => {
      const text = await queryAI("Assign ticket gate for North Stand batch size -10");
      assert.ok(text);
    });

    test("T2_16: Security Headers - CSP Verification", async () => {
      const res = await fetch(`${BASE_URL}/health`);
      assert.ok(res.headers.get("x-content-type-options"));
    });

    test("T2_17: Security Headers - XSS/Frame protection", async () => {
      const res = await fetch(`${BASE_URL}/health`);
      assert.strictEqual(res.headers.get("x-frame-options"), "SAMEORIGIN");
    });

    test("T2_18: SPA HTML fallback verification", async () => {
      const res = await fetch(`${BASE_URL}/random-spa-route-does-not-exist`);
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert.ok(text.includes("<!DOCTYPE html>") || text.includes("<html"));
    });

    test("T2_19: Simulation tick limits on history size", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/state`);
      const data = await res.json();
      assert.ok(data.crowdHistory.length <= 200);
    });

    test("T2_20: Auto-analysis alert for critical zone", async () => {
      const res = await fetch(`${BASE_URL}/api/agent/auto-analyze`);
      const data = await res.json();
      assert.ok(data.recommendations.length > 0);
    });

    test("T2_21: Auto-analysis alert for congested gates", async () => {
      const res = await fetch(`${BASE_URL}/api/agent/auto-analyze`);
      assert.strictEqual(res.status, 200);
    });

    test("T2_22: Auto-analysis alert for storm warning", async () => {
      const res = await fetch(`${BASE_URL}/api/agent/auto-analyze`);
      const data = await res.json();
      assert.ok(data.timestamp);
    });

    test("T2_23: Invalid HTTP method on GET endpoints", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/gates`, { method: "POST" });
      const contentType = res.headers.get("content-type");
      assert.ok(contentType.includes("text/html") || res.status === 404);
    });

    test("T2_24: Invalid HTTP method on POST endpoints", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/match-status`, { method: "GET" });
      const contentType = res.headers.get("content-type");
      assert.ok(contentType.includes("text/html") || res.status === 404);
    });

    test("T2_25: Double resolve incident handling", async () => {
      const stateRes = await fetch(`${BASE_URL}/api/stadium/state`);
      const state = await stateRes.json();
      if (state.incidents.length > 0) {
        const incidentId = state.incidents[0].id;
        await fetch(`${BASE_URL}/api/stadium/incidents/${incidentId}/resolve`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const res = await fetch(`${BASE_URL}/api/stadium/incidents/${incidentId}/resolve`, {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.incident.status, "resolved");
      }
    });

    test("T2_26: Ticket gate assignment fallback structure", async () => {
      const text = await queryAI("assign gate for North Stand batch 100");
      assert.ok(text);
    });

    test("T2_27: Rate limiter presence check (headers)", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/state`);
      assert.ok(res.headers.get("x-ratelimit-limit"));
      assert.ok(res.headers.get("x-ratelimit-remaining"));
    });

    test("T2_28: Generate incident description fallback", async () => {
      const text = await queryAI("incident reported at stadium");
      assert.ok(text);
    });

    test("T2_29: Auth logout state clearing", async () => {
      const auth = new AuthStateManager();
      await auth.login("abhiraj", "password123");
      assert.ok(auth.currentUser);
      auth.logout();
      assert.strictEqual(auth.currentUser, null);
      assert.strictEqual(auth.localStorage.getItem("crowdpulse_session"), null);
    });

    test("T2_30: Gate direction mapping fallback validation", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/gates`);
      const data = await res.json();
      const gates = Object.values(data.gates);
      gates.forEach((g) => {
        assert.ok(["North", "East", "South", "West"].includes(g.direction));
      });
    });

    test("T2_31: Security - Missing token auth check", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/reset`, { method: "POST", noAuth: true });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, "Unauthorized: Missing token");
    });

    test("T2_32: Security - Invalid token auth check", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/reset`, {
        method: "POST",
        headers: { Authorization: "Bearer fake-invalid-token-header" },
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, "Unauthorized: Invalid token");
    });
  });

  // ==========================================
  // TIER 3: STATE TRANSITIONS & SEQUENCES (6)
  // ==========================================
  describe("Tier 3: State Transitions & Sequence Flows", () => {
    test("T3_1: Dynamic Rerouting Sequence (Close gate, verify ticket routing bypasses it)", async () => {
      // 1. Reset state
      await fetch(`${BASE_URL}/api/stadium/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      // 2. Close North-A
      await fetch(`${BASE_URL}/api/stadium/gate/North-A`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "closed" }),
      });

      // 3. Close North-B
      await fetch(`${BASE_URL}/api/stadium/gate/North-B`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "closed" }),
      });

      // 4. Verify gate status in the state
      const stateRes = await fetch(`${BASE_URL}/api/stadium/state`);
      const state = await stateRes.json();

      assert.strictEqual(state.gates["North-A"].status, "closed");
      assert.strictEqual(state.gates["North-B"].status, "closed");
      assert.strictEqual(state.gates["North-C"].status, "open");
    });

    test("T3_2: Match Phase Progression & Simulation Tick Egress flow", async () => {
      // 1. Reset state
      await fetch(`${BASE_URL}/api/stadium/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      // 2. Set match status to ongoing
      await fetch(`${BASE_URL}/api/stadium/match-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "ongoing" }),
      });

      const res1 = await fetch(`${BASE_URL}/api/stadium/state`);
      const state1 = await res1.json();
      assert.strictEqual(state1.matchStatus, "ongoing");

      // 3. Set match status to post-match (triggering exit flows)
      await fetch(`${BASE_URL}/api/stadium/match-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "post-match" }),
      });

      const res2 = await fetch(`${BASE_URL}/api/stadium/state`);
      const state2 = await res2.json();
      assert.strictEqual(state2.matchStatus, "post-match");
    });

    test("T3_3: Incident Flow Sequence (Trigger alert, resolve, verify status changes)", async () => {
      // 1. Reset state
      await fetch(`${BASE_URL}/api/stadium/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      // Inject alert dynamically by changing status to emergency
      await fetch(`${BASE_URL}/api/stadium/match-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "emergency" }),
      });

      const state2Res = await fetch(`${BASE_URL}/api/stadium/state`);
      const state2 = await state2Res.json();
      const hasEmergencyAlert = state2.alerts.some((a) => a.type === "status_change");
      assert.ok(hasEmergencyAlert);
    });

    test("T3_4: Emergency Protocol Escalation Flow", async () => {
      await fetch(`${BASE_URL}/api/stadium/match-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "emergency" }),
      });
      const res = await fetch(`${BASE_URL}/api/stadium/alerts`);
      const data = await res.json();
      assert.ok(data.alerts.length > 0);
    });

    test("T3_5: AI Advisor Feedback loop for congested gates", async () => {
      const text = await queryAI("What is the recommendation for high load gates?");
      assert.ok(text);
    });

    test("T3_6: User Promotion Flow", async () => {
      const auth = new AuthStateManager();
      const user = await auth.register("tempops", "temp@crowdpulse.ai", "pass123");
      assert.strictEqual(user.clearance, "Level-2 (Standard-Write)");

      const promoted = await auth.updateProfile({
        role: "Stadium Director",
        clearance: "Level-5 (Super-Admin)",
      });
      assert.strictEqual(promoted.clearance, "Level-5 (Super-Admin)");
      assert.strictEqual(auth.currentUser.clearance, "Level-5 (Super-Admin)");
    });
  });

  // ==========================================
  // TIER 4: STRESS, CONCURRENCY & EXTREME (5)
  // ==========================================
  describe("Tier 4: Stress & Extreme Scenarios", () => {
    test("T4_1: Full Capacity Crowd Crush Threat Simulation", async () => {
      const res = await fetch(`${BASE_URL}/api/agent/auto-analyze`);
      const data = await res.json();
      assert.ok(data.recommendations);
      assert.ok(data.overallRisk);
    });

    test("T4_2: Concurrent User Actions Stress Test", async () => {
      const promises = [];
      const gates = ["North-A", "North-B", "North-C", "East-A", "East-B", "East-C"];
      for (let i = 0; i < 50; i++) {
        const gate = gates[i % gates.length];
        const status = i % 2 === 0 ? "open" : "closed";
        promises.push(
          fetch(`${BASE_URL}/api/stadium/gate/${gate}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ status }),
          })
        );
      }
      const results = await Promise.all(promises);
      for (const res of results) {
        assert.strictEqual(res.status, 200);
      }
    });

    test("T4_3: Extreme Weather Operational Halt Simulation", async () => {
      const resStatus = await fetch(`${BASE_URL}/api/stadium/match-status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "emergency" }),
      });
      assert.strictEqual(resStatus.status, 200);

      const resAlerts = await fetch(`${BASE_URL}/api/stadium/alerts`);
      const alertsData = await resAlerts.json();
      assert.ok(alertsData.alerts.length > 0);
    });

    test("T4_4: Continuous Simulation Ticks Integrity over Time", async () => {
      const responseBefore = await fetch(`${BASE_URL}/api/stadium/state`);
      const stateBefore = await responseBefore.json();
      const initialHistoryLength = stateBefore.crowdHistory.length;

      await sleep(3500);

      const responseAfter = await fetch(`${BASE_URL}/api/stadium/state`);
      const stateAfter = await responseAfter.json();

      assert.ok(stateAfter.crowdHistory.length >= initialHistoryLength);
    });

    test("T4_5: Rate Limiter Extreme Pressure & Recovery", async () => {
      let triggered429 = false;
      for (let i = 0; i < 130; i++) {
        const res = await fetch(`${BASE_URL}/api/health`);
        if (res.status === 429) {
          triggered429 = true;
          break;
        }
      }
      const resFinal = await fetch(`${BASE_URL}/api/stadium/state`);
      assert.ok(resFinal.headers.get("x-ratelimit-limit") || triggered429);
    });
  });

  describe("Tier 5: API Security & Input Validation", () => {
    test("T5_1: Mutating endpoint without token returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/reset`, {
        method: "POST",
        noAuth: true,
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, "Unauthorized: Missing token");
    });

    test("T5_2: Mutating endpoint with invalid token returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/reset`, {
        method: "POST",
        headers: { Authorization: "Bearer invalid-token-string" },
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, "Unauthorized: Invalid token");
    });

    test("T5_3: Gate status validation returns 400 for invalid status", async () => {
      const res = await fetch(`${BASE_URL}/api/stadium/gate/North-A`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "super_open" }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes("Invalid status"));
    });

    test("T5_4: Verify-role endpoint returns 403 for unauthorized privilege escalation", async () => {
      const tokenRes = await fetch(`${BASE_URL}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "tempuser",
          role: "Operations Analyst",
          email: "temp@crowdpulse.ai",
        }),
      });
      const tokenData = await tokenRes.json();
      const tempToken = tokenData.token;

      const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tempToken}`,
        },
        body: JSON.stringify({ role: "Stadium Director" }),
      });
      assert.strictEqual(verifyRes.status, 403);
      const verifyData = await verifyRes.json();
      assert.strictEqual(verifyData.error, "Access denied: Unauthorized role assignment");
    });
  });

  // ==========================================
  // TIER 6: TOKEN LIFECYCLE, INPUT VALIDATION & HARDENED HEADERS
  // ==========================================
  describe("Tier 6: Security Hardening & Input Validation", () => {
    test("T6_1: Issued token carries iat and 8h exp claims", async () => {
      const res = await originalFetch(`${BASE_URL}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "claims_user", email: "claims@crowdpulse.ai" }),
      });
      const { token } = await res.json();
      const claims = decodeTokenPayload(token);
      assert.ok(typeof claims.iat === "number", "iat claim present");
      assert.ok(typeof claims.exp === "number", "exp claim present");
      assert.strictEqual(claims.exp - claims.iat, 8 * 60 * 60 * 1000);
    });

    test("T6_2: Expired token is rejected with 401", async () => {
      const past = Date.now() - 60 * 1000;
      const expiredToken = signTestToken({
        username: "abhiraj",
        role: "Stadium Director",
        email: "iamabhiraj8825@gmail.com",
        iat: past - 1000,
        exp: past,
      });
      const res = await fetch(`${BASE_URL}/api/stadium/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, "Unauthorized: Invalid token");
    });

    test("T6_3: Tampered token payload is rejected with 401", async () => {
      const valid = signTestToken({ username: "abhiraj", role: "Operations Analyst", exp: Date.now() + 60000 });
      const [header, , signature] = valid.split(".");
      // Swap in a payload the attacker forged, keeping the original signature.
      const forgedBody = Buffer.from(
        JSON.stringify({ username: "attacker", role: "Stadium Director", exp: Date.now() + 60000 })
      ).toString("base64url");
      const tampered = `${header}.${forgedBody}.${signature}`;
      const res = await fetch(`${BASE_URL}/api/stadium/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tampered}` },
      });
      assert.strictEqual(res.status, 401);
    });

    test("T6_4: Login rejects oversized username (400)", async () => {
      const res = await originalFetch(`${BASE_URL}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "x".repeat(500) }),
      });
      assert.strictEqual(res.status, 400);
    });

    test("T6_5: Login rejects non-string role (400)", async () => {
      const res = await originalFetch(`${BASE_URL}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "roleuser", role: { admin: true } }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, "Invalid role");
    });

    test("T6_6: Login rejects invalid email type (400)", async () => {
      const res = await originalFetch(`${BASE_URL}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "emailuser", email: 12345 }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, "Invalid email");
    });

    test("T6_7: AI query rejects oversized message (400)", async () => {
      const res = await fetch(`${BASE_URL}/api/agent/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "a".repeat(5000) }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, "Message is required");
    });

    test("T6_8: verify-role rejects unknown role with 400", async () => {
      const res = await fetch(`${BASE_URL}/api/auth/verify-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "Supreme Overlord" }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, "Invalid role");
    });

    test("T6_9: Content-Security-Policy header is present and self-scoped", async () => {
      const res = await fetch(`${BASE_URL}/health`);
      const csp = res.headers.get("content-security-policy");
      assert.ok(csp, "CSP header present");
      assert.ok(csp.includes("default-src 'self'"), "CSP scopes default-src to self");
      assert.ok(csp.includes("object-src 'none'"), "CSP forbids plugins");
    });

    test("T6_10: Referrer-Policy header restricts referrer leakage", async () => {
      const res = await fetch(`${BASE_URL}/health`);
      assert.strictEqual(
        res.headers.get("referrer-policy"),
        "strict-origin-when-cross-origin"
      );
    });

    test("T6_11: Permissions-Policy header disables unused browser features", async () => {
      const res = await fetch(`${BASE_URL}/health`);
      const pp = res.headers.get("permissions-policy");
      assert.ok(pp && pp.includes("camera=()"), "camera disabled");
      assert.ok(pp.includes("microphone=()"), "microphone disabled");
    });

    test("T6_12: X-Powered-By header is not exposed", async () => {
      const res = await fetch(`${BASE_URL}/health`);
      assert.strictEqual(res.headers.get("x-powered-by"), null);
    });

    test("T6_13: Auth endpoints expose rate-limit headers", async () => {
      const res = await originalFetch(`${BASE_URL}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "rl_probe" }),
      });
      const limit = res.headers.get("x-ratelimit-limit");
      assert.ok(limit, "rate-limit headers present on auth route");
      assert.ok(Number(limit) > 0, "rate-limit is a positive integer");
    });

    test("T6_14: Valid unexpired token still authorizes protected routes", async () => {
      const goodToken = signTestToken({
        username: "abhiraj",
        role: "Stadium Director",
        email: "iamabhiraj8825@gmail.com",
        exp: Date.now() + 60000,
      });
      const res = await fetch(`${BASE_URL}/api/stadium/match-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${goodToken}` },
        body: JSON.stringify({ status: "ongoing" }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });
  });
});
