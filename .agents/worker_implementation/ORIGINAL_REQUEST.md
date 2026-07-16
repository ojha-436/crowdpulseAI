## 2026-07-14T09:33:05Z
You are the Implementation Track Worker (teamwork_preview_worker) for the CrowdPulse project.
Your working directory is d:\Hack2skill\crowdpulse\.agents\worker_implementation\.
Your task is to implement the following changes in the codebase:
1. Fix the Alert Banner rendering bug:
   - In `frontend/src/App.jsx`, pass the correct alerts array to `<AlertBanner>`.
   - In `frontend/src/components/AlertBanner.jsx`, filter active alerts using `severity === 'critical'` rather than `priority === 'critical'`.
2. Fix the Alerts Memory Leak / document limit issue:
   - In `backend/server.js`, add a check to trim/cap the `stadiumState.alerts` array so it does not grow indefinitely (cap at 50 items).
3. Improve Input Validation:
   - In the POST `/api/stadium/gate/:gateId` endpoint, validate that the input `status` is one of: "open", "closed", "restricted", "exit_only". Return a 400 error for invalid statuses.
4. Improve API Security:
   - Add simple token authentication middleware for state-mutating endpoints and `/api/agent/query`.
   - Guard against self-assigned privilege escalation in `ProfileView.jsx` by implementing role verification on the backend rather than letting the client arbitrarily elevate clearance.
5. Fix the Build Pipeline:
   - Create a multi-stage `Dockerfile` that compiles the frontend and copies the build assets into backend's serving folder.
6. Setup Linting and Formatting:
   - Add ESLint configurations, formatting scripts, and ensure we have `npm run lint` set up. Run lint checks and ensure they pass.
7. Prepare for Vercel Deployment:
   - Create `vercel.json` in the project root to support serverless deployment of both the backend and frontend.
MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work.
