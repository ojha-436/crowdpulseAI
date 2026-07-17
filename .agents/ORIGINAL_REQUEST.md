# Original User Request

## Initial Request — 2026-07-14T09:27:52Z

# Teamwork Project Prompt — Draft

> Status: Ready for launch — awaiting user approval
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Evaluate the existing CrowdPulse hackathon codebase against 6 key parameters, iteratively improve the code to achieve a 98/100 score on each, integrate the Gemini API, and prepare the app for Vercel deployment.

Working directory: d:\Hack2skill\crowdpulse
Integrity mode: development

**Problem Statement:**
Build a GenAI-enabled solution that enhances stadium operations and the overall tournament experience for fans, organizers, volunteers, or venue staff. The solution must leverage Generative AI to improve navigation, crowd management, accessibility, transportation, sustainability, multilingual assistance, operational intelligence, or real-time decision support during the FIFA World Cup 2026.

## Requirements

### R1. Initial Evaluation
Evaluate the existing solution in `d:\Hack2skill\crowdpulse` against 6 parameters: Code Quality, Accessibility, Problem Statement Alignment, Security, Testing, and Efficiency. Provide an initial report with scores (out of 100) and rationale.

### R2. Iterative Improvement
Iteratively update the codebase to improve the solution. You must continue improving until you are objectively confident that the application would score at least 98/100 on all 6 parameters. 

### R3. Gemini API Integration
Integrate the Gemini API into the application (using the free tier). The agent team should decide on the most effective use-case to support the problem statement (e.g., multilingual assistance, real-time decision support, etc.).

### R4. Vercel Deployment
Configure and prepare the application for deployment to Vercel.

## Acceptance Criteria

### Verification & Quality
- [ ] **Code Quality**: Linting and formatting checks (e.g., `npm run lint`) pass without any warnings or errors. Code is modular and well-structured.
- [ ] **Accessibility**: An automated accessibility audit (e.g., Lighthouse) yields a score of 98 or higher.
- [ ] **Problem Statement Alignment**: The application's features clearly demonstrate a GenAI-driven solution for stadium operations/experience (FIFA World Cup 2026).
- [ ] **Security**: Automated security scans (e.g., `npm audit`) show 0 high or critical vulnerabilities. Secrets and API keys are properly managed (not hardcoded).
- [ ] **Testing**: A functional test suite exists and all tests pass.
- [ ] **Efficiency**: Performance metrics (e.g., Lighthouse performance score) are 98 or higher.
- [ ] **Deployment**: The application builds successfully (e.g., `npm run build`) and generates Vercel-ready assets without errors.

## Follow-up — 2026-07-16T15:12:42+05:30

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Refactor and optimize the existing codebase at `d:\Hack2skill\crowdpulse` to maximize evaluation parameters, primarily focusing on improving the **Code Quality** score (currently 86/100) by adding comprehensive comments and docstrings. Finally, redeploy the application to Google Cloud Platform.

Working directory: d:\Hack2skill\crowdpulse
Integrity mode: development

## Requirements

### R1. Code Quality Optimization
The agent team must aggressively optimize the codebase to improve the Code Quality score to approach 100/100. This includes refactoring logic, restructuring files, and removing dead code as deemed necessary by the agent team.

### R2. Documentation and Remarks
Add comprehensive comments, remarks, and JSDoc/docstrings throughout the codebase (frontend and backend) to maximize transparency and accessibility.

### R3. Deployment
Redeploy the application to Google Cloud Platform (GCP) using the existing configuration files (`app.yaml`, `cloudbuild.yaml`, or `Dockerfile`).

## Acceptance Criteria

### Code Quality
- [ ] All major functions, components, and API endpoints have clear, descriptive comments or docstrings.
- [ ] Dead code, unused variables, and redundant imports are removed.
- [ ] If applicable, linting (`npm run lint`) passes successfully.

### Deployment
- [ ] The application successfully builds and deploys to Google Cloud Platform without errors.

