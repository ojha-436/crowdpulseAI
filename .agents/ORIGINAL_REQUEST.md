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
