/**
 * @file auth.js
 * @description Authentication routes: token issuance and role verification.
 * @module routes/auth
 */

import express from "express";
import { INPUT_LIMITS, DEFAULT_ROLE, VALID_ROLES, DEMO_LOGIN_ENABLED } from "../config.js";
import {
  authMiddleware,
  isValidString,
  isRoleAuthorized,
  clearanceForRole,
  signToken,
} from "../auth.js";

const router = express.Router();

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
router.post("/api/auth/token", (req, res) => {
  // In production, credential-free token issuance is disabled; identities must
  // be established out-of-band (e.g. a verified Firebase ID token). The demo
  // flow keeps this open so judges can sign in with one click.
  if (!DEMO_LOGIN_ENABLED) {
    return res.status(403).json({ error: "Demo login disabled; a verified identity is required" });
  }
  const { username, role, email } = req.body;
  if (!isValidString(username, INPUT_LIMITS.USERNAME)) {
    return res.status(400).json({ error: "Username is required" });
  }
  // Reject malformed optional fields rather than silently coercing them.
  if (email !== undefined && (typeof email !== "string" || email.length > INPUT_LIMITS.EMAIL)) {
    return res.status(400).json({ error: "Invalid email" });
  }
  if (role !== undefined && typeof role !== "string") {
    return res.status(400).json({ error: "Invalid role" });
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
router.post("/api/auth/verify-role", authMiddleware, (req, res) => {
  const { role: verifiedRole } = req.body;
  const { username, email } = req.user;

  // Only known roles may be requested; unknown values are invalid input (400).
  if (!VALID_ROLES.includes(verifiedRole)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  // Unlike the login endpoint, an explicit privilege-escalation request that
  // fails authorization is rejected outright with 403 rather than downgraded.
  if (!isRoleAuthorized(verifiedRole, { username, email })) {
    return res.status(403).json({ error: "Access denied: Unauthorized role assignment" });
  }

  const clearance = clearanceForRole(verifiedRole);
  const newToken = signToken({ username, role: verifiedRole, email, clearance });

  res.json({ success: true, role: verifiedRole, clearance, token: newToken });
});

export default router;
