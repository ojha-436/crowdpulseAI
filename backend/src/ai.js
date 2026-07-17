/**
 * @file ai.js
 * @description Google Gemini integration: the GenAI client, the agentic tool
 * (function-calling) declarations, the tool executor that reads/mutates stadium
 * state, and a static fallback used when the model is unavailable.
 * @module ai
 */

import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "./config.js";
import { stadiumState, addAlert } from "./state.js";
import { saveStadiumState } from "../db.js";

/**
 * The Google GenAI client instance.
 * Set to null if the Gemini API key is not configured.
 * @type {import('@google/genai').GoogleGenAI|null}
 */
export const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

/**
 * Builds the system prompt for a Gemini agent query using live stadium state.
 * @param {Object} state - The current stadium state.
 * @returns {string} The formatted system instruction string.
 */
export function buildSystemPrompt(state) {
  return `You are CrowdPulse AI, an intelligent stadium operations command center AI assistant for the "${state.name}" cricket stadium (capacity: ${state.capacity}).

Current State:
- Match Status: ${state.matchStatus}
- Current Occupancy: ${state.currentOccupancy} / ${state.capacity} (${((state.currentOccupancy / state.capacity) * 100).toFixed(1)}%)
- Weather: ${state.weatherCondition}, ${state.temperature.toFixed(1)}°C, Humidity: ${state.humidity.toFixed(0)}%
- Active Incidents: ${state.incidents.filter((i) => i.status === "active").length}

You have access to tools to monitor and control stadium operations. Use them proactively to:
1. Analyze crowd density and flow patterns
2. Recommend or execute gate rerouting to prevent bottlenecks
3. Trigger emergency protocols when needed
4. Optimize ticket-to-gate assignments
5. Monitor weather impacts on operations

Be decisive, data-driven, and proactive. When you detect risks, recommend specific actions. Format responses clearly with actionable insights. Use tools to gather data before making recommendations.`;
}

// --- Gemini Agentic Tools (Function Calling Definitions) ---
/**
 * Gemini Agentic Tools (Function Calling Definitions).
 * Declares the tool schemas available to the Gemini AI model for executing stadium operations.
 * @type {Array<Object>}
 */
export const agentTools = [
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
export function executeToolCall(name, args) {
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

/**
 * Generates a mock/fallback response when the Gemini AI API is unavailable.
 * Parses user input for keywords related to gates, zones, or emergencies and
 * formats a response using live stadiumState data.
 *
 * @param {string} message - The raw text query from the user.
 * @returns {string} The formatted fallback response.
 */
export function generateFallbackResponse(message) {
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
