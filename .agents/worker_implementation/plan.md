# Implementation Plan

This plan details the steps to implement and verify all required changes in the CrowdPulse codebase.

## Step 1: Fix the Alert Banner rendering bug
- **Task**: 
  - Update `frontend/src/App.jsx` to pass the correct alerts array `alerts={state.alerts}` to `<AlertBanner>`.
  - Update `frontend/src/components/AlertBanner.jsx` to filter active alerts using `severity === 'critical'` rather than `priority === 'critical'`.
- **Verification**: Inspect the code changes and verify they compile.

## Step 2: Fix the Alerts Memory Leak / document limit issue
- **Task**:
  - Update `backend/server.js` to add an `addAlert` helper function or inline checks that trim/cap the `stadiumState.alerts` array so it does not grow indefinitely (cap at 50 items).
- **Verification**: Inspect code, verify it compiles, and ensure `stadiumState.alerts.length` is capped.

## Step 3: Improve Input Validation
- **Task**:
  - In `backend/server.js`, locate `POST /api/stadium/gate/:gateId` endpoint.
  - Validate that `status` is one of: `"open"`, `"closed"`, `"restricted"`, `"exit_only"`. Return a `400` status code with an error message for invalid statuses.
- **Verification**: Run tests or construct mock requests to verify that invalid statuses return 400.

## Step 4: Improve API Security
- **Task**:
  - Implement a built-in JWT-like signed token system on the backend using the Node `crypto` module (HMAC-SHA256).
  - Add `/api/auth/token` endpoint to sign tokens for authenticated sessions.
  - Add `/api/auth/verify-role` endpoint to verify requested roles on the backend and return approved roles/clearances.
  - Implement `authMiddleware` to guard all state-mutating endpoints (`POST /api/stadium/reset`, `POST /api/stadium/match-status`, `POST /api/stadium/gate/:gateId`, `POST /api/stadium/incidents/:incidentId/resolve`) and `/api/agent/query`.
  - Update `frontend/src/context/AuthContext.jsx` to fetch and store the token from the backend during login, registration, and Google sign-in, and use it to verify role changes.
  - Update `frontend/src/hooks/useStadiumData.js` to attach the Bearer token to headers for state-mutating endpoints and agent query.
  - Update `frontend/src/components/ProfileView.jsx` to display any role verification errors from the backend.
- **Verification**: Verify that unauthorized requests (without token) to mutating endpoints return `401`, and invalid roles requested in profile view are rejected with `403`.

## Step 5: Fix the Build Pipeline
- **Task**:
  - Update the root `Dockerfile` to use a multi-stage build.
  - Stage 1: Build the frontend (run `npm run build` to generate `dist`).
  - Stage 2: Build/run the backend (copy `backend` files and copy the compiled frontend assets from Stage 1 into the backend `public` directory).
- **Verification**: Run `docker build` (if possible) or review the Dockerfile structure.

## Step 6: Setup Linting and Formatting
- **Task**:
  - Create a root `package.json` and install ESLint and Prettier dependencies.
  - Add a root `.eslintrc.json` configuration file supporting React, ESM, and Node environment.
  - Add a `.prettierrc` configuration file.
  - Add formatting and lint scripts.
  - Run linting and fix any violations.
- **Verification**: Execute `npm run lint` and verify it passes.

## Step 7: Prepare for Vercel Deployment
- **Task**:
  - Create a `vercel.json` configuration file in the project root to support serverless deployment.
  - Route `/api/(.*)` to `backend/server.js`.
  - Serve static frontend assets and handle SPA fallback for the react application.
- **Verification**: Review the `vercel.json` configuration file.
