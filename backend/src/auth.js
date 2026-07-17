/**
 * @file auth.js
 * @description Authentication and authorization helpers: JWT signing/verifying,
 * the Express auth middleware, input validation, and role-based access control.
 * @module auth
 */

import crypto from "crypto";
import {
  JWT_SECRET,
  TOKEN_TTL_MS,
  ROLE_CLEARANCE,
  ROLE_RANK,
  DEFAULT_ROLE,
  PRIVILEGED_ROLE_ALLOWLIST,
} from "./config.js";

/**
 * Constant-time string comparison to guard signature checks against timing
 * side-channel attacks. Returns false immediately when lengths differ.
 * @param {string} a - First value.
 * @param {string} b - Second value.
 * @returns {boolean} True if the values are byte-for-byte equal.
 */
export function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generates a signed JWT (HS256) for user authentication. Standard `iat`
 * (issued-at) and `exp` (expiry) claims are always stamped on the payload so
 * every issued token expires, regardless of what the caller passes.
 * @param {Object} payload - The data to encode in the token.
 * @returns {string} The signed JWT string.
 */
export function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Date.now();
  const claims = { ...payload, iat: now, exp: now + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies and decodes a given JWT token. Validates structure and signature
 * (in constant time) and rejects tokens whose `exp` claim has elapsed.
 * @param {string} token - The JWT string to verify.
 * @returns {Object|null} The decoded payload if valid, or null if invalid/expired.
 */
export function verifyToken(token) {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");
    if (!safeCompare(signature, expectedSignature)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    // Reject expired tokens (exp is epoch-millis stamped by signToken).
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    // Any decode/parse failure (malformed base64, non-JSON body, etc.) means
    // the token is simply invalid — there is no recoverable sub-case to handle
    // differently, so all such errors collapse to a null (unauthenticated) result.
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

/**
 * Express middleware factory enforcing a minimum role clearance on a route.
 * Must be mounted after {@link authMiddleware}, which populates `req.user`.
 * Requests whose role ranks below `minRank` are rejected with 403, so
 * privileged mutations require an appropriately-cleared operator rather than
 * merely any valid token.
 * @param {number} minRank - Minimum {@link ROLE_RANK} value required to proceed.
 * @returns {import('express').RequestHandler} The clearance-guard middleware.
 */
export function requireClearance(minRank) {
  return (req, res, next) => {
    const rank = ROLE_RANK[req.user?.role] || 0;
    if (rank < minRank) {
      return res.status(403).json({ error: "Forbidden: insufficient clearance for this action" });
    }
    next();
  };
}

/**
 * Validates that a value is a non-empty string no longer than maxLength.
 * @param {*} value - The value to check.
 * @param {number} maxLength - Inclusive maximum length.
 * @returns {boolean} True when value is a usable, in-bounds string.
 */
export function isValidString(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

/**
 * Determines whether an identity is permitted to hold a privileged role.
 *
 * Privileged roles are gated by the per-role allow-lists in
 * {@link PRIVILEGED_ROLE_ALLOWLIST} (sourced from environment configuration): an
 * identity is elevated only when its username or email is explicitly allow-listed.
 * Any role without an allow-list entry is non-privileged and granted freely.
 * Username/email are defaulted to empty strings so a missing field never throws,
 * and both sides are compared case-insensitively.
 *
 * @param {string} role - The role being requested.
 * @param {{ username?: string, email?: string }} identity - Requesting user's identity.
 * @returns {boolean} True if the identity may hold the requested role.
 */
export function isRoleAuthorized(role, { username = "", email = "" } = {}) {
  const allowList = PRIVILEGED_ROLE_ALLOWLIST[role];
  // Roles without an allow-list entry are unprivileged and require no check.
  if (!allowList) return true;
  const normalizedUsername = String(username).toLowerCase();
  const normalizedEmail = String(email).toLowerCase();
  return (
    allowList.usernames.includes(normalizedUsername) ||
    allowList.emails.includes(normalizedEmail)
  );
}

/**
 * Resolves the clearance label for a role, falling back to the default level.
 * @param {string} role - The role to look up.
 * @returns {string} The clearance label.
 */
export function clearanceForRole(role) {
  return ROLE_CLEARANCE[role] || ROLE_CLEARANCE[DEFAULT_ROLE];
}
