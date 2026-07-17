/**
 * @file server.js
 * @description Composition root for the CrowdPulse AI backend. Wires together
 * configuration, security middleware, rate limiting, static hosting, the API
 * routers, the SPA fallback, state hydration, and the simulation engine, then
 * starts the HTTP server. The application logic lives in the ./src modules.
 * @module server
 */

import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

import { PORT, GENERAL_RATE_LIMIT, AUTH_RATE_LIMIT } from "./src/config.js";
import { logger } from "./src/logger.js";
import { applySecurity } from "./src/middleware/security.js";
import { initStateFromDb } from "./src/state.js";
import { startSimulation } from "./src/simulation.js";
import { ai } from "./src/ai.js";
import healthRouter from "./src/routes/health.js";
import authRouter from "./src/routes/auth.js";
import stadiumRouter from "./src/routes/stadium.js";
import agentRouter from "./src/routes/agent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- Security Middleware (helmet CSP, Permissions-Policy, CORS, JSON body) ---
applySecurity(app);

/**
 * General API rate limiter. Caps traffic to /api/* per client IP to blunt
 * scraping and denial-of-service attempts.
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const limiter = rateLimit({
  windowMs: GENERAL_RATE_LIMIT.windowMs,
  max: GENERAL_RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. Please try again later." },
});
app.use("/api/", limiter);

/**
 * Stricter rate limiter dedicated to authentication endpoints. A tighter cap
 * raises the cost of credential-stuffing and token brute-force attacks without
 * impacting normal login usage.
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT.windowMs,
  max: AUTH_RATE_LIMIT.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." },
});
app.use("/api/auth/", authLimiter);

// --- Serve Static Frontend ---
app.use(express.static(path.join(__dirname, "public")));

// --- API Routes ---
app.use(healthRouter);
app.use(authRouter);
app.use(stadiumRouter);
app.use(agentRouter);

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

// --- Load state from Firestore, then start the simulation and HTTP server ---
await initStateFromDb();
startSimulation();

app.listen(PORT, () => {
  logger.info("server.started", {
    port: PORT,
    gemini: ai ? "connected" : "not-configured",
  });
});
