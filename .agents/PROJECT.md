# Project: CrowdPulse

## Architecture
- **Frontend**: Vite + React + Tailwind CSS, with Firebase client SDK.
- **Backend**: Node.js Express server (`server.js`) interacting with Firebase Firestore database (`db.js`).
- **External APIs**: Gemini API integration for GenAI-enabled stadium operations/experience (e.g. fan support, multilingual navigation, real-time decision assistance).
- **Deployment**: Configured for Vercel.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Initial Evaluation | Analyze current codebase, list lint/security/accessibility issues, prepare E2E test infra | None | DONE |
| M2 | Code Quality & Security | Fix lint warnings/errors and npm audit vulnerabilities | M1 | DONE |
| M3 | Efficiency & Accessibility | Maximize Lighthouse scores for Accessibility and Efficiency to >= 98 | M2 | DONE |
| M4 | Gemini API Integration | Integrate Gemini API on backend and add GenAI features on frontend | M2 | DONE |
| M5 | E2E Testing & Fixes | Ensure 100% of E2E tests (Tiers 1-4) pass | M3, M4 | DONE |
| M6 | Vercel Deployment Setup | Setup vercel.json configuration and verify build output | M5 | DONE |
| M7 | Final Acceptance & Audit | Run Forensic Auditor and verify overall scores are >= 98 | M6 | DONE |

## Interface Contracts
### Backend ↔ Frontend
- `GET /api/health`: Healthcheck endpoint
- `POST /api/chat`: Gemini-powered assistant endpoint for FIFA 2026 World Cup stadium navigation/support
- Firestore collections: `events`, `users`, `feedback`, `crowd_logs`
