/**
 * @file health.js
 * @description Health-check routes for container/hosting monitoring.
 * @module routes/health
 */

import express from "express";

const router = express.Router();

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
router.get("/health", handleHealthCheck);

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
router.get("/api/health", handleHealthCheck);

export default router;
