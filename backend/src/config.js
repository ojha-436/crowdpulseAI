/**
 * @file config.js
 * @description Central configuration module. Loads environment variables and
 * exposes all env-derived config and tuning constants used across the backend.
 * This is a leaf module (no internal dependencies) so it can be safely imported
 * everywhere without introducing circular references.
 * @module config
 */

import crypto from "crypto";

import dotenv from "dotenv";

import { logger } from "./logger.js";

dotenv.config();

/**
 * The port the HTTP server listens on.
 * @type {number|string}
 */
export const PORT = process.env.PORT || 8080;

/**
 * Secret used to sign/verify JWTs. Never hardcoded: it is read from the
 * JWT_SECRET environment variable in every real deployment. If it is absent
 * (local/dev), a random per-process secret is generated so tokens are still
 * valid within a single run — a warning makes the missing production secret
 * explicit rather than silently defaulting to a well-known value.
 * @type {string}
 */
export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.JWT_SECRET) {
  logger.warn("JWT_SECRET not set — generated an ephemeral per-process secret; set JWT_SECRET in production.");
}

/**
 * Whether the credential-free demo token endpoint is enabled. Defaults to true
 * so the one-click judge demo works. Set DEMO_LOGIN_ENABLED=false in production
 * to disable issuing tokens without a verified identity (see docs/SECURITY.md).
 * @type {boolean}
 */
export const DEMO_LOGIN_ENABLED =
  (process.env.DEMO_LOGIN_ENABLED ?? "true").toLowerCase() !== "false";

/**
 * Lifetime of an issued JWT, in milliseconds (8 hours). Tokens carry an `exp`
 * claim and are rejected once it passes, limiting the blast radius of a leaked token.
 * @type {number}
 */
export const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * The Google Gemini AI API key loaded from environment variables.
 * @type {string}
 */
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

/**
 * The Gemini model used for agent queries. Overridable via the GEMINI_MODEL
 * env var so the model can be upgraded without a code change when Google
 * retires older versions. Must be a model that supports function calling.
 * @type {string}
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Languages the AI assistant can respond in, for multilingual fan and staff
 * assistance during an international tournament. Keys are BCP-47-style codes
 * accepted from the client; values are the human-readable names injected into
 * the Gemini system prompt. Gemini is natively multilingual, so this is an
 * allow-list rather than a translation table.
 * @type {Readonly<Record<string, string>>}
 */
export const SUPPORTED_LANGUAGES = Object.freeze({
  en: "English",
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
  de: "German",
  ar: "Arabic",
  hi: "Hindi",
  ja: "Japanese",
});

/**
 * Default response language used when the client omits or requests an
 * unsupported language code.
 * @type {string}
 */
export const DEFAULT_LANGUAGE = "en";

/**
 * Allowed CORS origins. Parsed from a comma-separated ALLOWED_ORIGINS env var,
 * or "*" (any origin) when unset.
 * @type {string[]|string}
 */
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || "*";

/**
 * General API rate-limit configuration. Caps traffic to /api/* to blunt
 * scraping and denial-of-service attempts.
 * @type {{windowMs: number, max: number}}
 */
export const GENERAL_RATE_LIMIT = { windowMs: 1 * 60 * 1000, max: 120 };

/**
 * Stricter rate-limit configuration dedicated to authentication endpoints,
 * raising the cost of credential-stuffing and token brute-force attacks.
 * @type {{windowMs: number, max: number}}
 */
export const AUTH_RATE_LIMIT = { windowMs: 1 * 60 * 1000, max: 20 };

/**
 * Maximum accepted JSON request body size. Bounded body size mitigates
 * memory-exhaustion via oversized payloads.
 * @type {string}
 */
export const JSON_BODY_LIMIT = "256kb";

/**
 * Maximum accepted lengths for user-supplied string fields. Enforced early so
 * abusive or malformed payloads are rejected before hitting any business logic.
 * @type {Readonly<Record<string, number>>}
 */
export const INPUT_LIMITS = Object.freeze({ USERNAME: 64, EMAIL: 254, MESSAGE: 2000 });

// --- Role-Based Access Control (RBAC) Configuration ---
/**
 * Maps each operational role to its human-readable clearance label.
 * Higher levels grant broader command authority in the operations center.
 * Centralised here so the auth endpoints share a single source of truth.
 * @type {Readonly<Record<string, string>>}
 */
export const ROLE_CLEARANCE = Object.freeze({
  "Stadium Director": "Level-5 (Super-Admin)",
  "Security Chief": "Level-4 (Incident-Cmd)",
  "Operations Lead": "Level-3 (Tactical-Ops)",
  "Operations Analyst": "Level-2 (Standard-Write)",
});

/**
 * Numeric clearance rank per role, used by requireClearance() to gate
 * privileged mutations. Higher rank = broader authority. Kept alongside
 * ROLE_CLEARANCE so labels and ranks share one source of truth.
 * @type {Readonly<Record<string, number>>}
 */
export const ROLE_RANK = Object.freeze({
  "Stadium Director": 5,
  "Security Chief": 4,
  "Operations Lead": 3,
  "Operations Analyst": 2,
});

/**
 * Role assigned when none is requested, or when a request for a privileged
 * role fails authorization on the credential-only login endpoint.
 * @type {string}
 */
export const DEFAULT_ROLE = "Operations Analyst";

/**
 * The set of roles a client is permitted to request; anything else is rejected
 * as invalid input before authorization is even considered.
 * @type {ReadonlyArray<string>}
 */
export const VALID_ROLES = Object.freeze(Object.keys(ROLE_CLEARANCE));

/**
 * Parses a comma-separated environment variable into a normalized, de-duplicated
 * list of lowercased entries, falling back to the provided defaults when the
 * variable is unset. Centralised so every identity allow-list is parsed the same
 * way and deployments can override the defaults without a code change.
 * @param {string|undefined} rawValue - Raw comma-separated environment value.
 * @param {ReadonlyArray<string>} fallback - Default entries used when unset.
 * @returns {ReadonlyArray<string>} Frozen, lowercased, non-empty, unique entries.
 */
function parseIdentityList(rawValue, fallback) {
  const source = rawValue === undefined ? fallback : rawValue.split(",");
  const normalized = source.map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  return Object.freeze([...new Set(normalized)]);
}

/**
 * Per-role allow-lists of the identities permitted to hold each privileged role.
 * Sourced from optional comma-separated environment variables so real operator
 * usernames/emails live in configuration rather than in the authorization logic
 * itself. The defaults cover the built-in demo operators so the one-click logins
 * work out of the box, and can be overridden — or cleared — per deployment.
 *
 * Elevation requires an explicit match here: there is deliberately no "any
 * Google/Gmail account is an admin" wildcard, which would otherwise hand
 * super-admin clearance to every visitor who signs in with Google.
 * @type {Readonly<Record<string, { usernames: ReadonlyArray<string>, emails: ReadonlyArray<string> }>>}
 */
export const PRIVILEGED_ROLE_ALLOWLIST = Object.freeze({
  "Stadium Director": Object.freeze({
    usernames: parseIdentityList(process.env.PRIVILEGED_DIRECTOR_USERNAMES, ["abhiraj"]),
    emails: parseIdentityList(process.env.PRIVILEGED_DIRECTOR_EMAILS, ["iamabhiraj8825@gmail.com"]),
  }),
  "Security Chief": Object.freeze({
    usernames: parseIdentityList(process.env.PRIVILEGED_SECURITY_USERNAMES, ["security_chief"]),
    emails: parseIdentityList(process.env.PRIVILEGED_SECURITY_EMAILS, ["security@crowdpulse.ai"]),
  }),
});

/**
 * Tuning constants for the real-time crowd simulation. Grouped here so the
 * behaviour of the simulation is discoverable in one place rather than as
 * magic numbers scattered through simulateTick().
 * @type {Readonly<Object>}
 */
export const SIM = Object.freeze({
  TICK_INTERVAL_MS: 3000, // Wall-clock interval between simulation ticks.
  // Persist simulation state to Firestore only every Nth tick (not every tick),
  // cutting steady-state writes ~10x. Mutations still persist immediately, so
  // durability of user actions is unaffected; only routine sim drift is batched.
  PERSIST_EVERY_TICKS: 10,
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
