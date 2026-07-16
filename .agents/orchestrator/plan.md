# CrowdPulse Orchestration Plan

This document outlines the systematic steps to evaluate, improve, and prepare the CrowdPulse hackathon codebase for Vercel deployment.

## Execution Topology
We will run a dual-track parallel workflow under the Project pattern:
1. **Implementation Track**: Responsible for evaluating the codebase, executing refactoring/fixes to reach a score of 98/100, integrating the Gemini API, and preparing the configurations for Vercel.
2. **E2E Testing Track**: Responsible for designing an independent, requirement-driven, opaque-box E2E test suite.

Both tracks will run under our supervision. We will spawn subagents for:
- Code exploration/investigation (`teamwork_preview_explorer`)
- Code writing and implementation (`teamwork_preview_worker`)
- Code review and verification (`teamwork_preview_reviewer`)
- Forensic Auditing (`teamwork_preview_auditor`)

---

## Detailed Milestones

### Milestone 1: Exploration, Evaluation, and Test Suite Design
- **Goal**: Assess the current state of the application, design the E2E test suite (Dual-track startup).
- **Steps**:
  1. Spawn **Explorer** to analyze the backend (`server.js`, `db.js`) and frontend codebase structure.
  2. Spawn **Explorer** to run `npm run lint`, `npm audit`, and check existing tests.
  3. Spawn **E2E Testing Orchestrator** to design the `TEST_INFRA.md` and draft Tier 1-4 test scenarios.

### Milestone 2: Implementation & E2E Test Suite Creation
- **Goal**: Setup the test framework and start implementing improvements.
- **Steps**:
  1. Build the test runner and implement E2E test cases in the test suite.
  2. Implement code quality fixes (lint errors/warnings) and security fixes (npm audit vulnerabilities).

### Milestone 3: Feature Improvements & Accessibility
- **Goal**: Fix Accessibility and Efficiency parameters.
- **Steps**:
  1. Run Lighthouse audits on the frontend pages (via chrome-devtools or a worker).
  2. Address accessibility gaps (missing alt text, aria labels, color contrast, etc.).
  3. Address efficiency gaps (caching, bundle size, script loading).

### Milestone 4: Gemini API Integration
- **Goal**: Integrate Generative AI to enhance tournament/stadium operations.
- **Steps**:
  1. Identify the best use case (e.g., real-time navigation/assistance, multilingual fan support, volunteer chat).
  2. Implement backend endpoint using Gemini API.
  3. Integrate the AI features in the frontend UI.

### Milestone 5: Testing & Acceptance Gating
- **Goal**: Verify that 100% of E2E tests pass.
- **Steps**:
  1. Decompose by test tier (Tier 1 -> Tier 2 -> Tier 3 -> Tier 4).
  2. Run the iterative fix loop for each tier until it passes.

### Milestone 6: Vercel Deployment & Adversarial Hardening (Tier 5)
- **Goal**: Setup Vercel deployment assets and run adversarial coverage tests.
- **Steps**:
  1. Configure `vercel.json` and ensure frontend/backend build commands succeed.
  2. Run adversarial checks to locate any hidden gaps/edge cases.

### Milestone 7: Final Forensic Audit
- **Goal**: Run Forensic Auditor to guarantee code integrity and zero-cheating.
- **Steps**:
  1. Run `teamwork_preview_auditor`.
  2. Synthesize results and report success.
