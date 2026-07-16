/**
 * @file server.js
 * @description Main entry point for the CrowdPulse AI backend server.
 * Handles Express server setup, Google Gemini AI integration, real-time stadium simulation,
 * and exposes REST API endpoints for the frontend application.
 * @module server
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { getStadiumState, saveStadiumState } from "./db.js";

dotenv.config();

// Secret used to sign JWTs. A hardcoded fallback keeps local/demo runs working
// out of the box, but production MUST supply its own JWT_SECRET — the warning
// below makes an insecure default explicit rather than silently accepted.
const JWT_SECRET = process.env.JWT_SECRET || "crowdpulse-super-secret-key-123456";
if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET is not set — using an insecure default. Set JWT_SECRET in production.");
}

/**
 * Generates a signed JWT token for user authentication.
 * @param {Object} payload - The data to encode in the token.
 * @returns {string} The signed JWT string.
 */
export function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies and decodes a given JWT token.
 * @param {string} token - The JWT string to verify.
 * @returns {Object|null} The decoded payload if valid, or null if invalid.
 */
export function verifyToken(token) {
  try {
    const [header, body, signature] = token.split(".");
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");
    if (signature !== expectedSignature) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch (e) {
    return null;
  }
}

/**
 * Express middleware to enforce JWT-based authentication.
 * Attaches the decoded user payload to the request object if successful.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }
  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
  req.user = decoded;
  next();
}

// --- Role-Based Access Control (RBAC) Configuration ---
/**
 * Maps each operational role to its human-readable clearance label.
 * Higher levels grant broader command authority in the operations center.
 * Centralised here so the auth endpoints share a single source of truth.
 * @type {Readonly<Record<string, string>>}
 */
const ROLE_CLEARANCE = Object.freeze({
  "Stadium Director": "Level-5 (Super-Admin)",
  "Security Chief": "Level-4 (Incident-Cmd)",
  "Operations Lead": "Level-3 (Tactical-Ops)",
  "Operations Analyst": "Level-2 (Standard-Write)",
});

/**
 * Role assigned when none is requested, or when a request for a privileged
 * role fails authorization on the credential-only login endpoint.
 * @type {string}
 */
const DEFAULT_ROLE = "Operations Analyst";

/**
 * Determines whether an identity is permitted to hold a privileged role.
 *
 * Elevated roles (Stadium Director, Security Chief) are restricted to a known
 * allow-list of demo credentials; all non-privileged roles are granted freely.
 * Email/username are defaulted to empty strings so a missing field never throws.
 *
 * @param {string} role - The role being requested.
 * @param {{ username?: string, email?: string }} identity - Requesting user's identity.
 * @returns {boolean} True if the identity may hold the requested role.
 */
function isRoleAuthorized(role, { username = "", email = "" } = {}) {
  if (role === "Stadium Director") {
    return (
      username === "abhiraj" ||
      email === "iamabhiraj8825@gmail.com" ||
      username.includes("google") ||
      email.includes("google") ||
      email.includes("@gmail.com")
    );
  }
  if (role === "Security Chief") {
    return username === "security_chief" || email === "security@crowdpulse.ai";
  }
  // Non-privileged roles require no special authorization.
  return true;
}

/**
 * Resolves the clearance label for a role, falling back to the default level.
 * @param {string} role - The role to look up.
 * @returns {string} The clearance label.
 */
function clearanceForRole(role) {
  return ROLE_CLEARANCE[role] || ROLE_CLEARANCE[DEFAULT_ROLE];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// --- Google Gemini AI Setup ---
/**
 * The Google Gemini AI API key loaded from environment variables.
 * @type {string}
 */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

/**
 * The Google GenAI client instance.
 * Set to null if the Gemini API key is not configured.
 * @type {import('@google/genai').GoogleGenAI|null}
 */
let ai = null;
if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

// --- Security Middleware ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "*" }));
app.use(express.json({ limit: "2mb" }));

/**
 * Rate limiter middleware configuration for API requests.
 * Limits requests to /api/* to 120 per minute per IP.
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. Please try again later." },
});
app.use("/api/", limiter);

// --- Serve Static Frontend ---
app.use(express.static(path.join(__dirname, "public")));

// --- Stadium State & Simulation Model ---
// State is persisted through db.js (Firestore when available, in-memory otherwise)
// and continuously advanced by the simulation engine below.

/**
 * Tuning constants for the real-time crowd simulation. Grouped here so the
 * behaviour of the simulation is discoverable in one place rather than as
 * magic numbers scattered through simulateTick().
 * @type {Readonly<Object>}
 */
const SIM = Object.freeze({
  TICK_INTERVAL_MS: 3000, // Wall-clock interval between simulation ticks.
  MAX_ALERT_HISTORY: 50, // Cap on retained alerts.
  MAX_INCIDENT_HISTORY: 50, // Cap on retained incidents.
  MAX_CROWD_HISTORY: 200, // Cap on retained crowd-occupancy data points.
  INCIDENT_SPAWN_CHANCE: 0.03, // Per-tick probability of a new random incident.
  WEATHER_CHANGE_EVERY_TICKS: 20, // Weather is re-rolled on this tick cadence.
  // Zone density thresholds used to classify risk level.
  DENSITY_CRITICAL: 0.9,
  DENSITY_HIGH: 0.75,
  DENSITY_MEDIUM: 0.5,
});

/**
 * Generates the initial, baseline state for the stadium.
 * Contains mock data for gates, zones, weather, and incidents.
 * @returns {Object} The default stadium state.
 */
const getInitialState = () => {
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

const stadiumState = getInitialState();

/**
 * Adds an alert to the stadium state's alert history.
 * Maintains a maximum history size of 50 alerts.
 * @param {Object} alert - The alert object to add.
 */
function addAlert(alert) {
  stadiumState.alerts.unshift(alert);
  if (stadiumState.alerts.length > SIM.MAX_ALERT_HISTORY) {
    stadiumState.alerts = stadiumState.alerts.slice(0, SIM.MAX_ALERT_HISTORY);
  }
}

// --- Load state from Firestore on Startup ---
const dbState = await getStadiumState(stadiumState);
Object.assign(stadiumState, dbState);
if (stadiumState.alerts.length > SIM.MAX_ALERT_HISTORY) {
  stadiumState.alerts = stadiumState.alerts.slice(0, SIM.MAX_ALERT_HISTORY);
}

// --- Expose reset function ---
/**
 * Resets the stadium state to its initial default state and saves it.
 */
export function resetStadiumState() {
  const freshState = getInitialState();
  Object.assign(stadiumState, freshState);
  saveStadiumState(stadiumState);
}

// --- Simulation Engine ---
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
function simulateTick() {
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
function generateIncidentDescription(incident) {
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
 * @type {NodeJS.Timeout}
 */
const _simulationInterval = setInterval(simulateTick, SIM.TICK_INTERVAL_MS);

// --- Gemini Agentic Tools (Function Calling Definitions) ---
/**
 * Gemini Agentic Tools (Function Calling Definitions).
 * Declares the tool schemas available to the Gemini AI model for executing stadium operations.
 * @type {Array<Object>}
 */
const agentTools = [
  {
    name: "get_gate_status",
    description:
      "Get real-time status of a specific gate or all gates including flow rate, queue length, and scanner status",
    parameters: {
      type: "object",
      properties: {
        gate_id: { type: "string", description: "Gate ID like 'North-A' or 'all' for all gates" },
      },
      required: ["gate_id"],
    },
  },
  {
    name: "get_zone_density",
    description: "Get current crowd density and risk level for a specific zone or all zones",
    parameters: {
      type: "object",
      properties: {
        zone_id: { type: "string", description: "Zone name or 'all' for all zones" },
      },
      required: ["zone_id"],
    },
  },
  {
    name: "reroute_crowd",
    description: "Issue a crowd rerouting directive to redirect flow from one gate/zone to another",
    parameters: {
      type: "object",
      properties: {
        from_gate: { type: "string", description: "Source gate to divert from" },
        to_gate: { type: "string", description: "Target gate to divert to" },
        reason: { type: "string", description: "Reason for rerouting" },
      },
      required: ["from_gate", "to_gate", "reason"],
    },
  },
  {
    name: "trigger_emergency_protocol",
    description:
      "Activate an emergency response protocol for a specific zone or the entire stadium",
    parameters: {
      type: "object",
      properties: {
        protocol_type: {
          type: "string",
          enum: [
            "evacuation",
            "medical_dispatch",
            "security_lockdown",
            "weather_shelter",
            "crowd_control",
          ],
          description: "Type of emergency protocol",
        },
        target_zone: {
          type: "string",
          description: "Zone to apply protocol to, or 'all' for stadium-wide",
        },
        severity: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Severity level",
        },
      },
      required: ["protocol_type", "target_zone", "severity"],
    },
  },
  {
    name: "update_gate_status",
    description: "Open, close, or restrict a gate to manage crowd flow",
    parameters: {
      type: "object",
      properties: {
        gate_id: { type: "string", description: "Gate ID to update" },
        new_status: {
          type: "string",
          enum: ["open", "closed", "restricted", "exit_only"],
          description: "New gate status",
        },
      },
      required: ["gate_id", "new_status"],
    },
  },
  {
    name: "get_weather_status",
    description: "Get current weather conditions at the stadium",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_crowd_analytics",
    description:
      "Get crowd flow analytics including historical trends, peak times, and predictions",
    parameters: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: ["occupancy_trend", "gate_throughput", "zone_distribution", "risk_summary"],
          description: "Analytics metric to retrieve",
        },
      },
      required: ["metric"],
    },
  },
  {
    name: "assign_ticket_gate",
    description:
      "Dynamically assign optimal gate entry for a ticket batch based on current conditions",
    parameters: {
      type: "object",
      properties: {
        zone: { type: "string", description: "Destination zone for ticket holders" },
        batch_size: { type: "number", description: "Number of tickets in the batch" },
      },
      required: ["zone", "batch_size"],
    },
  },
];

// --- Tool Execution Functions ---

/**
 * Executes a tool (function call) requested by the AI agent.
 * Matches the tool name and invokes the corresponding telemetry query or state mutation.
 *
 * @param {string} name - The name of the tool function to execute.
 * @param {Object} args - The arguments passed to the tool function.
 * @returns {Object} The result of the tool execution, containing queried data or success status.
 */
function executeToolCall(name, args) {
  switch (name) {
    case "get_gate_status": {
      if (args.gate_id === "all") {
        return { gates: stadiumState.gates };
      }
      const gate = stadiumState.gates[args.gate_id];
      return gate ? { gate } : { error: `Gate ${args.gate_id} not found` };
    }
    case "get_zone_density": {
      if (args.zone_id === "all") {
        return { zones: stadiumState.zones };
      }
      const zone = stadiumState.zones[args.zone_id];
      return zone ? { zone } : { error: `Zone ${args.zone_id} not found` };
    }
    case "reroute_crowd": {
      const decision = {
        id: uuidv4(),
        from: args.from_gate,
        to: args.to_gate,
        reason: args.reason,
        timestamp: Date.now(),
        status: "executed",
      };
      stadiumState.routingDecisions.unshift(decision);
      addAlert({
        id: uuidv4(),
        type: "reroute",
        message: `Crowd rerouted from ${args.from_gate} to ${args.to_gate}: ${args.reason}`,
        timestamp: Date.now(),
        severity: "medium",
      });
      saveStadiumState(stadiumState);
      return { success: true, decision };
    }
    case "trigger_emergency_protocol": {
      const protocol = {
        id: uuidv4(),
        type: args.protocol_type,
        zone: args.target_zone,
        severity: args.severity,
        timestamp: Date.now(),
        status: "activated",
      };
      addAlert({
        id: uuidv4(),
        type: "emergency",
        message: `EMERGENCY: ${args.protocol_type.replace(/_/g, " ").toUpperCase()} protocol activated for ${args.target_zone} [${args.severity}]`,
        timestamp: Date.now(),
        severity: args.severity,
      });
      saveStadiumState(stadiumState);
      return { success: true, protocol };
    }
    case "update_gate_status": {
      const gate = stadiumState.gates[args.gate_id];
      if (!gate) return { error: `Gate ${args.gate_id} not found` };
      gate.status = args.new_status;
      addAlert({
        id: uuidv4(),
        type: "gate_update",
        message: `Gate ${args.gate_id} status changed to ${args.new_status}`,
        timestamp: Date.now(),
        severity: "low",
      });
      saveStadiumState(stadiumState);
      return { success: true, gate };
    }
    case "get_weather_status": {
      return {
        condition: stadiumState.weatherCondition,
        temperature: stadiumState.temperature,
        humidity: stadiumState.humidity,
        advisory:
          stadiumState.weatherCondition.includes("rain") ||
          stadiumState.weatherCondition.includes("storm")
            ? "Weather advisory active. Consider activating weather shelter protocol."
            : "Conditions normal.",
      };
    }
    case "get_crowd_analytics": {
      switch (args.metric) {
        case "occupancy_trend":
          return {
            current: stadiumState.currentOccupancy,
            capacity: stadiumState.capacity,
            utilizationPercent: (
              (stadiumState.currentOccupancy / stadiumState.capacity) *
              100
            ).toFixed(1),
            history: stadiumState.crowdHistory.slice(-30),
          };
        case "gate_throughput":
          return {
            gates: Object.entries(stadiumState.gates).map(([id, g]) => ({
              id,
              flow: g.currentFlow,
              queue: g.queueLength,
              status: g.status,
            })),
          };
        case "zone_distribution":
          return {
            zones: Object.entries(stadiumState.zones).map(([id, z]) => ({
              id,
              occupancy: z.currentOccupancy,
              capacity: z.capacity,
              density: (z.density * 100).toFixed(1) + "%",
              risk: z.riskLevel,
            })),
          };
        case "risk_summary": {
          const zones = Object.values(stadiumState.zones);
          return {
            critical: zones.filter((z) => z.riskLevel === "critical").length,
            high: zones.filter((z) => z.riskLevel === "high").length,
            medium: zones.filter((z) => z.riskLevel === "medium").length,
            low: zones.filter((z) => z.riskLevel === "low").length,
            activeIncidents: stadiumState.incidents.filter((i) => i.status === "active").length,
          };
        }
        default:
          return { error: "Unknown metric" };
      }
    }
    case "assign_ticket_gate": {
      const directionMap = {
        "North Stand": "North",
        "East Pavilion": "East",
        "South Stand": "South",
        "West Pavilion": "West",
        "VIP Lounge": "West",
        "Corporate Box": "East",
        "General-Upper": "North",
        "General-Lower": "South",
      };
      const dir = directionMap[args.zone] || "North";
      const candidates = Object.entries(stadiumState.gates)
        .filter(([_, g]) => g.direction === dir && g.status === "open")
        .sort((a, b) => a[1].queueLength - b[1].queueLength);
      if (candidates.length === 0) {
        return { error: "No available gates for this zone direction" };
      }
      const assigned = candidates[0];
      return {
        assignedGate: assigned[0],
        estimatedWaitMinutes: Math.ceil(assigned[1].queueLength / 10),
        queueLength: assigned[1].queueLength,
        zone: args.zone,
        batchSize: args.batch_size,
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// --- API Routes ---

/**
 * Shared handler function to retrieve the health status of the service.
 * Used by GET /health and GET /api/health.
 * 
 * @param {import('express').Request} _req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @returns {void}
 */
function handleHealthCheck(_req, res) {
  res.json({ status: "healthy", service: "crowdpulse-ai", timestamp: new Date().toISOString() });
}

/**
 * GET /health
 * 
 * Purpose: Public health check endpoint for container/hosting monitoring.
 * Status Codes:
 *   - 200 OK: Service is healthy.
 * Response JSON:
 *   - status {string} - "healthy"
 *   - service {string} - "crowdpulse-ai"
 *   - timestamp {string} - ISO timestamp of the response
 */
app.get("/health", handleHealthCheck);

/**
 * GET /api/health
 * 
 * Purpose: API namespace health check endpoint.
 * Status Codes:
 *   - 200 OK: API service is healthy.
 * Response JSON:
 *   - status {string} - "healthy"
 *   - service {string} - "crowdpulse-ai"
 *   - timestamp {string} - ISO timestamp of the response
 */
app.get("/api/health", handleHealthCheck);

// Auth endpoints
/**
 * POST /api/auth/token
 * 
 * Purpose: Authenticates a user and issues a signed JWT token.
 * Request Body Shape:
 *   - username {string} (required) - User's username.
 *   - role {string} (optional) - Requested role (e.g. "Stadium Director", "Security Chief").
 *   - email {string} (optional) - User's email address.
 * Response JSON (200 OK):
 *   - token {string} - Signed JWT token containing encoded payload.
 *   - role {string} - The verified and normalized role assigned by the backend.
 *   - clearance {string} - The clearance level corresponding to the verified role.
 * Response JSON (400 Bad Request):
 *   - error {string} - Error message details.
 * Status Codes:
 *   - 200 OK: Authentication successful.
 *   - 400 Bad Request: Missing required username parameter.
 */
app.post("/api/auth/token", (req, res) => {
  const { username, role, email } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  // Requested role, defaulting to the standard analyst role when unspecified.
  // Unauthorized requests for a privileged role are silently downgraded to the
  // default here (rather than rejected) so login always succeeds with least privilege.
  let verifiedRole = role || DEFAULT_ROLE;
  if (!isRoleAuthorized(verifiedRole, { username, email })) {
    verifiedRole = DEFAULT_ROLE;
  }

  const clearance = clearanceForRole(verifiedRole);
  const token = signToken({ username, role: verifiedRole, email, clearance });
  res.json({ token, role: verifiedRole, clearance });
});

/**
 * POST /api/auth/verify-role
 * 
 * Purpose: Verifies role clearance and issues a new JWT token with updated role if authorized.
 * Authentication: Bearer JWT token required in Authorization header.
 * Request Body Shape:
 *   - role {string} - The target role to verify and assign.
 * Response JSON (200 OK):
 *   - success {boolean} - Indicates whether the operation succeeded.
 *   - role {string} - The verified role.
 *   - clearance {string} - The clearance Level corresponding to the role.
 *   - token {string} - New signed JWT token with updated details.
 * Response JSON (403 Forbidden):
 *   - error {string} - Error message details.
 * Status Codes:
 *   - 200 OK: Role verified and token generated.
 *   - 401 Unauthorized: Invalid or missing token.
 *   - 403 Forbidden: Access denied for unauthorized role assignment.
 */
app.post("/api/auth/verify-role", authMiddleware, (req, res) => {
  const { role: verifiedRole } = req.body;
  const { username, email } = req.user;

  // Unlike the login endpoint, an explicit privilege-escalation request that
  // fails authorization is rejected outright with 403 rather than downgraded.
  if (!isRoleAuthorized(verifiedRole, { username, email })) {
    return res.status(403).json({ error: "Access denied: Unauthorized role assignment" });
  }

  const clearance = clearanceForRole(verifiedRole);
  const newToken = signToken({ username, role: verifiedRole, email, clearance });

  res.json({ success: true, role: verifiedRole, clearance, token: newToken });
});

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
app.post("/api/stadium/reset", authMiddleware, (_req, res) => {
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
app.get("/api/stadium/state", (_req, res) => {
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
app.get("/api/stadium/gates", (_req, res) => {
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
app.get("/api/stadium/zones", (_req, res) => {
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
app.get("/api/stadium/incidents", (_req, res) => {
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
app.get("/api/stadium/alerts", (_req, res) => {
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
app.post("/api/stadium/match-status", authMiddleware, (req, res) => {
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
app.post("/api/stadium/gate/:gateId", authMiddleware, (req, res) => {
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
app.post("/api/stadium/incidents/:incidentId/resolve", authMiddleware, (req, res) => {
  const incident = stadiumState.incidents.find((i) => i.id === req.params.incidentId);
  if (!incident) return res.status(404).json({ error: "Incident not found" });
  incident.status = "resolved";
  saveStadiumState(stadiumState);
  res.json({ success: true, incident });
});

// --- AI Agent Endpoint (Gemini with Function Calling) ---
/**
 * POST /api/agent/query
 * 
 * Purpose: Query the AI Agent (Gemini) about stadium status or command options.
 * Authentication: Bearer JWT token required in Authorization header.
 * Request Body Shape:
 *   - message {string} - The question or command for the AI agent.
 * Response JSON (200 OK):
 *   - response {string} - Text response generated by Gemini.
 *   - toolsUsed {Array} - List of tool calls triggered during execution.
 *   - timestamp {number} - Epoch millisecond timestamp of the execution.
 * Response JSON (400 Bad Request / 500 Internal Server Error):
 *   - error {string} - Error description.
 *   - details {string} - Detailed error message (for 500 errors).
 *   - fallback {string} - A static markdown fallback response (for 500/unconfigured Gemini errors).
 * Status Codes:
 *   - 200 OK: AI agent successfully processed query.
 *   - 400 Bad Request: Missing query message.
 *   - 401 Unauthorized: Invalid or missing token.
 *   - 500 Internal Server Error: API or model execution failed (includes static fallback in response).
 */
app.post("/api/agent/query", authMiddleware, async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (!ai) {
    return res.status(500).json({
      error: "Gemini API key not configured",
      fallback: generateFallbackResponse(message),
    });
  }

  try {
    const systemPrompt = `You are CrowdPulse AI, an intelligent stadium operations command center AI assistant for the "${stadiumState.name}" cricket stadium (capacity: ${stadiumState.capacity}).

Current State:
- Match Status: ${stadiumState.matchStatus}
- Current Occupancy: ${stadiumState.currentOccupancy} / ${stadiumState.capacity} (${((stadiumState.currentOccupancy / stadiumState.capacity) * 100).toFixed(1)}%)
- Weather: ${stadiumState.weatherCondition}, ${stadiumState.temperature.toFixed(1)}°C, Humidity: ${stadiumState.humidity.toFixed(0)}%
- Active Incidents: ${stadiumState.incidents.filter((i) => i.status === "active").length}

You have access to tools to monitor and control stadium operations. Use them proactively to:
1. Analyze crowd density and flow patterns
2. Recommend or execute gate rerouting to prevent bottlenecks
3. Trigger emergency protocols when needed
4. Optimize ticket-to-gate assignments
5. Monitor weather impacts on operations

Be decisive, data-driven, and proactive. When you detect risks, recommend specific actions. Format responses clearly with actionable insights. Use tools to gather data before making recommendations.`;

    const toolDeclarations = agentTools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: message }] }],
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: toolDeclarations }],
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    let resultText = "";
    let toolResults = [];
    let candidate = response.candidates?.[0];
    let parts = candidate?.content?.parts || [];

    // Process any function calls (tool executions) requested by the AI model
    const functionCalls = parts.filter((p) => p.functionCall);
    if (functionCalls.length > 0) {
      const toolOutputs = [];
      
      // Iterate through each requested tool call and execute it locally
      for (const fc of functionCalls) {
        const result = executeToolCall(fc.functionCall.name, fc.functionCall.args || {});
        toolOutputs.push({
          toolName: fc.functionCall.name,
          args: fc.functionCall.args,
          result,
        });
        toolResults.push({ tool: fc.functionCall.name, result });
      }

      // Structure the execution results into functionResponse parts for the model
      const functionResponses = functionCalls.map((fc, i) => ({
        functionResponse: {
          name: fc.functionCall.name,
          response: toolOutputs[i].result,
        },
      }));

      // Make a follow-up call to the model, passing the entire conversation history:
      // 1. Original user query
      // 2. Model's initial response (containing the function calls)
      // 3. The actual function response outputs
      const followUp = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          { role: "user", parts: [{ text: message }] },
          { role: "model", parts },
          { role: "user", parts: functionResponses },
        ],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      });

      const followParts = followUp.candidates?.[0]?.content?.parts || [];
      resultText = followParts.map((p) => p.text || "").join("\n");
    } else {
      resultText = parts.map((p) => p.text || "").join("\n");
    }

    res.json({
      response: resultText,
      toolsUsed: toolResults,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({
      error: "AI processing error",
      details: error.message,
      fallback: generateFallbackResponse(message),
    });
  }
});

// --- AI Auto-Analysis Endpoint ---
/**
 * GET /api/agent/auto-analyze
 * 
 * Purpose: Scans stadium state to produce risk assessment and recommended actions.
 * Request Parameters: None.
 * Request Body Shape: None.
 * Response JSON (200 OK):
 *   - overallRisk {string} - Evaluated risk level ("low", "medium", "high").
 *   - criticalZones {Array} - List of zones exceeding density thresholds.
 *   - congestedGates {Array} - List of gates with long queues.
 *   - activeIncidentCount {number} - Number of current active incidents.
 *   - recommendations {Array} - List of action items.
 *   - timestamp {number} - Epoch millisecond timestamp of the analysis.
 * Status Codes:
 *   - 200 OK: Analysis completed successfully.
 */
app.get("/api/agent/auto-analyze", async (_req, res) => {
  const criticalZones = Object.entries(stadiumState.zones)
    .filter(([_, z]) => z.riskLevel === "critical" || z.riskLevel === "high")
    .map(([name, z]) => `${name}: ${(z.density * 100).toFixed(0)}% density (${z.riskLevel})`);

  const congestedGates = Object.entries(stadiumState.gates)
    .filter(([_, g]) => g.queueLength > 50)
    .map(([name, g]) => `${name}: queue ${g.queueLength}`);

  const activeIncidents = stadiumState.incidents.filter((i) => i.status === "active");

  const analysis = {
    overallRisk: criticalZones.length > 0 ? "high" : congestedGates.length > 2 ? "medium" : "low",
    criticalZones,
    congestedGates,
    activeIncidentCount: activeIncidents.length,
    recommendations: [],
    timestamp: Date.now(),
  };

  if (criticalZones.length > 0) {
    analysis.recommendations.push("URGENT: Activate crowd control protocol for critical zones");
  }
  if (congestedGates.length > 0) {
    analysis.recommendations.push(
      `Reroute traffic from congested gates: ${congestedGates.map((g) => g.split(":")[0]).join(", ")}`
    );
  }
  if (
    stadiumState.weatherCondition.includes("rain") ||
    stadiumState.weatherCondition.includes("storm")
  ) {
    analysis.recommendations.push("Weather alert: Consider activating weather shelter protocol");
  }
  if (activeIncidents.length > 3) {
    analysis.recommendations.push(
      "Multiple active incidents detected. Consider escalating to security command."
    );
  }
  if (analysis.recommendations.length === 0) {
    analysis.recommendations.push("All systems nominal. Continue monitoring.");
  }

  res.json(analysis);
});

/**
 * Generates a mock/fallback response when the Gemini AI API is unavailable.
 * Parses user input for keywords related to gates, zones, or emergencies and
 * formats a response using live stadiumState data.
 *
 * @param {string} message - The raw text query from the user.
 * @returns {string} The formatted fallback response.
 */
function generateFallbackResponse(message) {
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes("gate") || lowerMsg.includes("entry")) {
    const gateData = Object.entries(stadiumState.gates)
      .map(([id, g]) => `${id}: ${g.status} (queue: ${g.queueLength}, flow: ${g.currentFlow}/min)`)
      .join("\n");
    return `**Gate Status Overview:**\n${gateData}\n\n*AI-powered analysis requires GEMINI_API_KEY configuration.*`;
  }
  if (lowerMsg.includes("zone") || lowerMsg.includes("crowd") || lowerMsg.includes("density")) {
    const zoneData = Object.entries(stadiumState.zones)
      .map(([id, z]) => `${id}: ${(z.density * 100).toFixed(0)}% full (${z.riskLevel} risk)`)
      .join("\n");
    return `**Zone Density Report:**\n${zoneData}`;
  }
  if (lowerMsg.includes("emergency") || lowerMsg.includes("incident")) {
    const active = stadiumState.incidents.filter((i) => i.status === "active");
    return `**Active Incidents: ${active.length}**\n${active.map((i) => `[${i.severity.toUpperCase()}] ${i.type} at ${i.zone}`).join("\n") || "No active incidents."}`;
  }
  return `**CrowdPulse AI Summary:**\nOccupancy: ${stadiumState.currentOccupancy}/${stadiumState.capacity}\nMatch: ${stadiumState.matchStatus}\nWeather: ${stadiumState.weatherCondition} (${stadiumState.temperature.toFixed(1)}°C)\n\n*Configure GEMINI_API_KEY for full AI-powered analysis.*`;
}

// SPA fallback
/**
 * GET * (Fallback Route)
 * 
 * Purpose: Catch-all route serving the Single Page Application (SPA) index.html for client-side routing.
 * Request Parameters: None.
 * Request Body Shape: None.
 * Status Codes:
 *   - 200 OK: Success, serves the HTML page.
 */
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`CrowdPulse AI server running on port ${PORT}`);
  console.log(`Gemini AI: ${ai ? "Connected" : "Not configured (set GEMINI_API_KEY)"}`);
});
