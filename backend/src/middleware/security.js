/**
 * @file security.js
 * @description Baseline security middleware: helmet (with an explicit CSP),
 * a Permissions-Policy header, CORS, and a bounded JSON body parser — applied
 * to the app in the same order the original server configured them.
 * @module middleware/security
 */

import cors from "cors";
import helmet from "helmet";
import express from "express";
import { ALLOWED_ORIGINS, JSON_BODY_LIMIT } from "../config.js";

/**
 * Applies the standard security middleware stack to an Express app.
 * @param {import('express').Express} app - The Express application instance.
 */
export function applySecurity(app) {
  // --- Security Middleware ---
  // Content-Security-Policy is defined explicitly (rather than disabled) to
  // restrict where scripts, styles, fonts, and network calls may originate.
  // The allow-list covers exactly what the SPA needs: Google Fonts and the
  // Firebase Authentication endpoints. Everything else falls back to 'self'.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // 'unsafe-inline' on styles is required for inline style attributes
          // (e.g. dynamic progress-bar widths) and Google Fonts stylesheets.
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          // Firebase Auth + Firestore + same-origin API calls.
          connectSrc: [
            "'self'",
            "https://*.googleapis.com",
            "https://*.firebaseapp.com",
            "https://identitytoolkit.googleapis.com",
            "https://securetoken.googleapis.com",
          ],
          frameSrc: ["'self'", "https://*.firebaseapp.com"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'self'"],
        },
      },
      // Restrict how much referrer information leaks to third parties.
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      // Opt out of cross-origin embedding of our resources.
      crossOriginResourcePolicy: { policy: "same-origin" },
      // Enforce HTTPS for one year, including subdomains.
      hsts: { maxAge: 31536000, includeSubDomains: true },
    })
  );

  // Disable browser features the app never uses, reducing the attack surface.
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");
    next();
  });

  app.use(cors({ origin: ALLOWED_ORIGINS }));
  // Bounded JSON body size mitigates memory-exhaustion via oversized payloads.
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
}
