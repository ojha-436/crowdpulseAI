# Quality & Security Audit Report

## Summary of Findings
CrowdPulse suffers from critical build pipeline integration gaps, unauthenticated backend REST APIs, client-side security bypasses (including self-assigned privilege escalation), and a complete lack of testing or linting frameworks. Resolving these issues is necessary before deploying to production.

---

## 1. Observations

### A. Missing Test & Lint Scripts in `package.json` files
- **Backend `package.json`** (`d:\Hack2skill\crowdpulse\backend\package.json`):
  ```json
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  }
  ```
- **Frontend `package.json`** (`d:\Hack2skill\crowdpulse\frontend\package.json`):
  ```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
  ```
*No linting, code formatting, security auditing, or test scripts are defined in either codebase.*

### B. Broken Frontend Build Pipeline Integration
- **`.gitignore`** (`d:\Hack2skill\crowdpulse\.gitignore`):
  Line 12: `backend/public/assets/`
- **`Dockerfile`** (`d:\Hack2skill\crowdpulse\Dockerfile`):
  ```dockerfile
  COPY backend/package*.json ./
  RUN npm ci --omit=dev
  COPY backend/ ./
  ```
- **`cloudbuild.yaml`** (`d:\Hack2skill\crowdpulse\cloudbuild.yaml`):
  Only runs `docker build -t ...` and deploys to Cloud Run. No steps build the frontend.
*Since the compiled assets are gitignored and not built during the Docker image build or Cloud Build pipeline, the deployed container has no compiled frontend assets, resulting in a blank page (404 for assets).*

### C. Hardcoded Credentials & Plaintext Password Storage
- **`frontend/src/context/AuthContext.jsx`** (`d:\Hack2skill\crowdpulse\frontend\src\context\AuthContext.jsx`):
  ```javascript
  const DEFAULT_USERS = [
    {
      username: 'abhiraj',
      email: 'iamabhiraj8825@gmail.com',
      password: 'password123',
      displayName: 'Abhiraj Singh',
      role: 'Stadium Director',
      avatar: 'director',
      clearance: 'Level-5 (Super-Admin)',
      ...
    },
    {
      username: 'security_chief',
      email: 'security@crowdpulse.ai',
      password: 'password123',
      displayName: 'Vikram Malhotra',
      role: 'Security Chief',
      avatar: 'security',
      clearance: 'Level-4 (Incident-Cmd)',
      ...
    },
  ];
  ```
*Plaintext credentials are committed to the codebase. In addition, the registration and authentication process stores user records in plaintext inside `localStorage` (`crowdpulse_users` and `crowdpulse_session`).*

### D. Self-Assigned Privilege Escalation
- **`frontend/src/components/ProfileView.jsx`** (`d:\Hack2skill\crowdpulse\frontend\src\components\ProfileView.jsx`):
  ```javascript
  const handleUpdate = async (e) => {
    e.preventDefault();
    ...
    const updates = {
      displayName,
      role,
      avatar,
      clearance: roleClearance[role] || 'Level-2 (Standard-Write)',
    };
    ...
    await updateProfile(updates);
  ```
*The dropdown allows any user to select any role (e.g., changing from "Operations Analyst" to "Stadium Director") and automatically raises their clearance level to Level-5 (Super-Admin) in `localStorage`.*

### E. Unauthenticated Backend APIs
- **`backend/server.js`** (`d:\Hack2skill\crowdpulse\backend\server.js`):
  Routes such as `/api/stadium/match-status`, `/api/stadium/gate/:gateId`, and `/api/stadium/incidents/:incidentId/resolve` accept POST requests directly without verifying any session token, authorization header, or API key.

### F. Missing Input Validation on Gate Status
- **`backend/server.js`** (`d:\Hack2skill\crowdpulse\backend\server.js`):
  ```javascript
  app.post("/api/stadium/gate/:gateId", (req, res) => {
    const { gateId } = req.params;
    const { status } = req.body;
    const gate = stadiumState.gates[gateId];
    if (!gate) return res.status(404).json({ error: "Gate not found" });
    gate.status = status;
    saveStadiumState(stadiumState);
    res.json({ success: true, gate });
  });
  ```
*The `status` variable is directly assigned to `gate.status` without checking if it belongs to valid gate statuses (`"open"`, `"closed"`, `"restricted"`, `"exit_only"`), making the server state vulnerable to unexpected data types or malformed strings.*

### G. Complete Absence of Tests or Linting Configs
- There are no tests, specs, or test/lint configurations (no `.eslintrc`, `prettier.config.js`, `jest.config.js`, etc.) present in the repository.

---

## 2. Logic Chain

1. **Missing scripts in `package.json`** directly correlates to the **complete lack of testing and linting tools** in the development workflow, making it difficult to maintain code quality or prevent regressions.
2. **Gitignoring `/assets/`** while having **no build step for the frontend in the Dockerfile or Cloud Build** leads to a container that starts up successfully but fails to load the application frontend.
3. **Implementing authentication entirely client-side using local storage** combined with **plaintext password storage** means credentials and sessions are exposed to XSS attacks, tampering, and session-hijacking.
4. **Allowing the profile page to set arbitrary roles** combined with **unauthenticated backend endpoints** means there is no actual security perimeter. Any client can modify any configuration (such as closing gates or triggering evacuation protocols) by simply hitting the endpoints directly.
5. **No input validation on `status`** in `/api/stadium/gate/:gateId` allows arbitrary payloads to corrupt the stadium state, which could crash the simulator or the frontend dashboard.

---

## 3. Caveats

- **Network Constraints**: Terminal tests (`npm audit`, `npm install`) could not be run because the shell permissions timed out. The security analysis is based on static verification of the source code and the resolved `package-lock.json` dependency versions.
- **Firebase Auth**: Firebase Google Auth setup exists in `AuthContext.jsx` but is completely missing from the login/signup views. The project remains reliant on local mock users.

---

## 4. Conclusion & Actionable Resolution Plan

### Phase 1: Fix the Build and Deployment Pipeline (High Priority)
To ensure the frontend is built and served in production:
1. **Option A: Multi-Stage Dockerfile (Recommended)**: Rewrite `Dockerfile` to build the frontend as a builder stage, and copy the compiled assets to the public directory of the node server.
   ```dockerfile
   # Stage 1: Build Frontend
   FROM node:20-slim AS frontend-builder
   WORKDIR /app/frontend
   COPY frontend/package*.json ./
   RUN npm ci
   COPY frontend/ ./
   RUN npm run build

   # Stage 2: Serve Backend
   FROM node:20-slim
   WORKDIR /app
   COPY backend/package*.json ./
   RUN npm ci --omit=dev
   COPY backend/ ./
   COPY --from=frontend-builder /app/frontend/dist ./public
   EXPOSE 8080
   ENV PORT=8080
   ENV NODE_ENV=production
   CMD ["node", "server.js"]
   ```

### Phase 2: Remediate Security Vulnerabilities (High Priority)
1. **Secure Backend Routes**:
   - Integrate authentication validation middleware on the backend. If using Firebase Auth, verify the Firebase ID token in the `Authorization: Bearer <Token>` header using `firebase-admin`.
2. **Remove Hardcoded Credentials & Client-side Database**:
   - Deprecate `DEFAULT_USERS` in `AuthContext.jsx`.
   - Implement real user authentication against a backend auth service or Firebase Auth.
   - Store session identifiers (JWTs or session tokens) securely in HTTP-only, secure cookies or secure headers rather than client-modifiable `localStorage` objects.
3. **Role Enforcement on Backend**:
   - Backend APIs must enforce authorization based on user claims (e.g. `req.user.role === 'Stadium Director'`) rather than trusting the frontend's visual state.
4. **API Input Validation**:
   - In `backend/server.js`, validate gate statuses:
     ```javascript
     const validStatuses = ["open", "closed", "restricted", "exit_only"];
     if (!validStatuses.includes(status)) {
       return res.status(400).json({ error: "Invalid gate status" });
     }
     ```

### Phase 3: Add Quality, Linting, & Testing Frameworks (Medium Priority)
1. **Set Up Linting & Formatting**:
   - Install ESLint and Prettier in both directories:
     ```bash
     npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-react
     ```
   - Configure `.eslintrc.json` and `.prettierrc` configuration files.
   - Add `"lint": "eslint ."` and `"format": "prettier --write ."` to the `scripts` object in both `package.json` files.
2. **Set Up Testing Framework**:
   - Install Jest (backend) and Vitest (frontend):
     ```bash
     npm install --save-dev jest supertest (backend)
     npm install --save-dev vitest @testing-library/react (frontend)
     ```
   - Add unit tests for API endpoints in `backend/server.test.js` and component tests in `frontend/src/components/AICommandPanel.test.jsx`.
   - Configure `"test": "jest"` and `"test": "vitest"` scripts.

---

## 5. Verification Method

To verify these fixes:
1. **Build Verification**:
   - Run `docker build -t crowdpulse-test .` from the root directory.
   - Start the container: `docker run -p 8080:8080 crowdpulse-test`.
   - Access `http://localhost:8080` in a browser. Ensure the page loads without 404 console errors for static assets.
2. **Security & Input Validation Verification**:
   - Send a POST request to `/api/stadium/gate/North-A` with an invalid status:
     ```bash
     curl -X POST http://localhost:8080/api/stadium/gate/North-A \
       -H "Content-Type: application/json" \
       -d '{"status": "broken"}'
     ```
   - Verify that the server returns a `400 Bad Request` and does not update the gate status.
3. **Linting and Testing Verification**:
   - Run `npm run lint` and `npm run test` in both frontend and backend directories. Ensure all checks and test suites pass successfully.
