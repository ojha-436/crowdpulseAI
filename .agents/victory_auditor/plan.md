# Victory Audit Plan - CrowdPulse

This plan outlines the verification steps to independently audit project completion.

## Steps

1. **Phase A: Timeline & Provenance Audit**
   - Check folder modification logs and git repository structure if available.
   - Inspect `.agents/` progress files to trace milestone completion.
   - Verify absence of pre-populated log files, test result files, or verification artifacts in the codebase.

2. **Phase B: Forensic Integrity Checks**
   - Inspect backend server routes (`backend/server.js`) to verify dynamic behavior (e.g. status validation, auth integration, simulations, Gemini API integration, and fallbacks).
   - Inspect frontend context and API queries (`frontend/src/`) to verify dynamic server calls (rather than mock client-side results).
   - Inspect E2E test file (`backend/tests/e2e.test.js`) to check for hardcoded test results, facade logic, or test assertion overrides.

3. **Phase C: Independent Test Execution**
   - Run the E2E test suite from the root folder:
     `node backend/tests/run-e2e.js`
   - Run the frontend Vite production build:
     `npm run build` inside `frontend/` directory (or `npm run build` in root if configured).
   - Compare actual test counts and outputs with the claims in `TEST_READY.md` and progress reports.
