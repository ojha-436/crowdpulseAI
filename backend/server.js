import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";
import { getStadiumState, saveStadiumState } from "./db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// --- Google Gemini AI Setup ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
let ai = null;
if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

// --- Security Middleware ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "*" }));
app.use(express.json({ limit: "2mb" }));

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

// --- In-Memory Data Store (Simulates Firestore for MVP) ---
const stadiumState = {
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

// Initialize 12 gates
const gateNames = [
  "North-A", "North-B", "North-C",
  "East-A", "East-B", "East-C",
  "South-A", "South-B", "South-C",
  "West-A", "West-B", "West-C",
];

gateNames.forEach((name, i) => {
  stadiumState.gates[name] = {
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

// Initialize 8 zones
const zoneNames = ["North Stand", "East Pavilion", "South Stand", "West Pavilion", "VIP Lounge", "Corporate Box", "General-Upper", "General-Lower"];
zoneNames.forEach((name, i) => {
  const cap = name.includes("VIP") ? 5000 : name.includes("Corporate") ? 3000 : 18000;
  stadiumState.zones[name] = {
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

// --- Load state from Firestore on Startup ---
const dbState = await getStadiumState(stadiumState);
Object.assign(stadiumState, dbState);

// --- Simulation Engine ---
let simulationInterval = null;
let tickCount = 0;

function simulateTick() {
  tickCount++;
  const { matchStatus, gates, zones } = stadiumState;

  // Simulate crowd flow based on match status
  const flowMultiplier =
    matchStatus === "pre-match" ? 1.2 :
    matchStatus === "ongoing" ? 0.1 :
    matchStatus === "break" ? 0.4 :
    matchStatus === "post-match" ? -1.5 : 0;

  let totalOccupancy = 0;

  Object.values(gates).forEach((gate) => {
    if (gate.status === "open") {
      const baseFlow = Math.floor(Math.random() * 80 + 40);
      gate.currentFlow = Math.max(0, Math.floor(baseFlow * Math.abs(flowMultiplier)));
      gate.queueLength = Math.max(0, gate.queueLength + Math.floor(Math.random() * 20 - 8));
      gate.currentLoad = Math.min(gate.maxCapacity, gate.currentLoad + (flowMultiplier > 0 ? gate.currentFlow : -gate.currentFlow));
      gate.currentLoad = Math.max(0, gate.currentLoad);
      gate.avgProcessingTime = 5 + Math.random() * 10;
    } else {
      gate.currentFlow = 0;
    }
  });

  Object.values(zones).forEach((zone) => {
    const inflow = Math.floor(Math.random() * 200 * Math.abs(flowMultiplier));
    if (flowMultiplier > 0) {
      zone.currentOccupancy = Math.min(zone.capacity, zone.currentOccupancy + inflow);
    } else {
      zone.currentOccupancy = Math.max(0, zone.currentOccupancy - inflow);
    }
    zone.density = zone.currentOccupancy / zone.capacity;
    zone.riskLevel = zone.density > 0.9 ? "critical" : zone.density > 0.75 ? "high" : zone.density > 0.5 ? "medium" : "low";
    zone.temperature = 32 + Math.random() * 5;
    totalOccupancy += zone.currentOccupancy;
  });

  stadiumState.currentOccupancy = totalOccupancy;

  // Record history
  stadiumState.crowdHistory.push({
    timestamp: Date.now(),
    occupancy: totalOccupancy,
    tick: tickCount,
  });
  if (stadiumState.crowdHistory.length > 200) stadiumState.crowdHistory.shift();

  // Random incidents
  if (Math.random() < 0.03) {
    const incidentTypes = ["medical", "security", "congestion", "equipment_failure", "weather_alert"];
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
    if (stadiumState.incidents.length > 50) stadiumState.incidents.pop();
  }

  // Weather fluctuation
  if (tickCount % 20 === 0) {
    const conditions = ["clear", "cloudy", "light_rain", "heavy_rain", "storm_warning"];
    stadiumState.weatherCondition = conditions[Math.floor(Math.random() * conditions.length)];
    stadiumState.temperature = 28 + Math.random() * 12;
    stadiumState.humidity = 40 + Math.random() * 50;
  }

  // Save state to Firestore
  saveStadiumState(stadiumState);
}

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

// Start simulation
simulationInterval = setInterval(simulateTick, 3000);

// --- Gemini Agentic Tools (Function Calling Definitions) ---
const agentTools = [
  {
    name: "get_gate_status",
    description: "Get real-time status of a specific gate or all gates including flow rate, queue length, and scanner status",
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
    description: "Activate an emergency response protocol for a specific zone or the entire stadium",
    parameters: {
      type: "object",
      properties: {
        protocol_type: { type: "string", enum: ["evacuation", "medical_dispatch", "security_lockdown", "weather_shelter", "crowd_control"], description: "Type of emergency protocol" },
        target_zone: { type: "string", description: "Zone to apply protocol to, or 'all' for stadium-wide" },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Severity level" },
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
        new_status: { type: "string", enum: ["open", "closed", "restricted", "exit_only"], description: "New gate status" },
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
    description: "Get crowd flow analytics including historical trends, peak times, and predictions",
    parameters: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["occupancy_trend", "gate_throughput", "zone_distribution", "risk_summary"], description: "Analytics metric to retrieve" },
      },
      required: ["metric"],
    },
  },
  {
    name: "assign_ticket_gate",
    description: "Dynamically assign optimal gate entry for a ticket batch based on current conditions",
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
      stadiumState.alerts.unshift({
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
      stadiumState.alerts.unshift({
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
      stadiumState.alerts.unshift({
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
        advisory: stadiumState.weatherCondition.includes("rain") || stadiumState.weatherCondition.includes("storm")
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
            utilizationPercent: ((stadiumState.currentOccupancy / stadiumState.capacity) * 100).toFixed(1),
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
        .filter(([id, g]) => g.direction === dir && g.status === "open")
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

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "crowdpulse-ai", timestamp: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", service: "crowdpulse-ai", timestamp: new Date().toISOString() });
});

// Get full stadium state
app.get("/api/stadium/state", (req, res) => {
  const { crowdHistory, ...stateWithoutHistory } = stadiumState;
  res.json({
    ...stateWithoutHistory,
    currentOccupancy: stadiumState.currentOccupancy,
    utilizationPercent: ((stadiumState.currentOccupancy / stadiumState.capacity) * 100).toFixed(1),
    activeIncidents: stadiumState.incidents.filter((i) => i.status === "active").length,
    crowdHistory: stadiumState.crowdHistory.slice(-60),
  });
});

// Get gates
app.get("/api/stadium/gates", (req, res) => {
  res.json({ gates: stadiumState.gates });
});

// Get zones
app.get("/api/stadium/zones", (req, res) => {
  res.json({ zones: stadiumState.zones });
});

// Get incidents
app.get("/api/stadium/incidents", (req, res) => {
  res.json({ incidents: stadiumState.incidents.slice(0, 20) });
});

// Get alerts
app.get("/api/stadium/alerts", (req, res) => {
  res.json({ alerts: stadiumState.alerts.slice(0, 30) });
});

// Update match status
app.post("/api/stadium/match-status", (req, res) => {
  const { status } = req.body;
  const validStatuses = ["pre-match", "ongoing", "break", "post-match", "emergency"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid match status" });
  }
  stadiumState.matchStatus = status;
  stadiumState.alerts.unshift({
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
app.post("/api/stadium/gate/:gateId", (req, res) => {
  const { gateId } = req.params;
  const { status } = req.body;
  const gate = stadiumState.gates[gateId];
  if (!gate) return res.status(404).json({ error: "Gate not found" });
  gate.status = status;
  saveStadiumState(stadiumState);
  res.json({ success: true, gate });
});

// Resolve incident
app.post("/api/stadium/incidents/:incidentId/resolve", (req, res) => {
  const incident = stadiumState.incidents.find((i) => i.id === req.params.incidentId);
  if (!incident) return res.status(404).json({ error: "Incident not found" });
  incident.status = "resolved";
  saveStadiumState(stadiumState);
  res.json({ success: true, incident });
});

// --- AI Agent Endpoint (Gemini with Function Calling) ---
app.post("/api/agent/query", async (req, res) => {
  const { message, context } = req.body;

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

    // Process function calls
    const functionCalls = parts.filter((p) => p.functionCall);
    if (functionCalls.length > 0) {
      const toolOutputs = [];
      for (const fc of functionCalls) {
        const result = executeToolCall(fc.functionCall.name, fc.functionCall.args || {});
        toolOutputs.push({
          toolName: fc.functionCall.name,
          args: fc.functionCall.args,
          result,
        });
        toolResults.push({ tool: fc.functionCall.name, result });
      }

      // Second call with tool results
      const functionResponses = functionCalls.map((fc, i) => ({
        functionResponse: {
          name: fc.functionCall.name,
          response: toolOutputs[i].result,
        },
      }));

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
app.get("/api/agent/auto-analyze", async (req, res) => {
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
    analysis.recommendations.push(`Reroute traffic from congested gates: ${congestedGates.map((g) => g.split(":")[0]).join(", ")}`);
  }
  if (stadiumState.weatherCondition.includes("rain") || stadiumState.weatherCondition.includes("storm")) {
    analysis.recommendations.push("Weather alert: Consider activating weather shelter protocol");
  }
  if (activeIncidents.length > 3) {
    analysis.recommendations.push("Multiple active incidents detected. Consider escalating to security command.");
  }
  if (analysis.recommendations.length === 0) {
    analysis.recommendations.push("All systems nominal. Continue monitoring.");
  }

  res.json(analysis);
});

// Fallback response when Gemini is unavailable
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
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`CrowdPulse AI server running on port ${PORT}`);
  console.log(`Gemini AI: ${ai ? "Connected" : "Not configured (set GEMINI_API_KEY)"}`);
});
