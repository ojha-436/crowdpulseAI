// Ambient type augmentation: authMiddleware attaches the decoded JWT payload
// to req.user, so every protected route can read the authenticated identity.
import "express";

declare global {
  namespace Express {
    interface Request {
      /** Decoded JWT claims set by authMiddleware on protected routes. */
      user?: {
        username?: string;
        email?: string;
        role?: string;
        clearance?: string;
        iat?: number;
        exp?: number;
      };
    }
  }
}
