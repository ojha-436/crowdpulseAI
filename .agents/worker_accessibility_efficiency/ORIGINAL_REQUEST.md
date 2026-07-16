## 2026-07-14T09:41:31Z
You are the Accessibility & Efficiency Specialist (teamwork_preview_worker) for the CrowdPulse project.
Your working directory is d:\Hack2skill\crowdpulse\.agents\worker_accessibility_efficiency\.
Your task is to fix the accessibility and performance/efficiency issues on the frontend:
1. Fix Unassociated Labels:
   - In `frontend/src/components/AuthPage.jsx` and `frontend/src/components/ProfileView.jsx`, add unique `id` attributes to all form input/select elements, and connect their `<label>` elements using the matching `htmlFor` attributes.
2. Fix Keyboard Inaccessible Gate Cards:
   - In `frontend/src/components/GateGrid.jsx`, add `tabIndex={0}`, `role="button"`, `aria-label={`Gate ${id} status: ${gate.status}`}`, and an `onKeyDown` handler (supporting Enter and Space keys) to the gate card `div` elements, allowing keyboard-only users to navigate and select gates.
3. Fix Missing Aria Labels:
   - Add clear `aria-label` attributes to all icon-only buttons in `AICommandPanel.jsx` (close and send buttons), `AlertBanner.jsx` (dismiss button), and `IncidentFeed.jsx` (resolve incident button).
4. Address Color Contrast Gaps:
   - Search the frontend codebase for Tailwind colors that have low contrast over dark backgrounds (like `text-gray-500` or `text-gray-600` on midnight bg `#0a0e1a` or `#111827`).
   - Replace them with higher contrast text classes (e.g. `text-gray-300`, `text-gray-400`, or direct high-contrast hex styling) to satisfy the 4.5:1 WCAG AA contrast ratio.
5. Optimize API Polling & Consolidate:
   - Check `frontend/src/App.jsx`. It runs two concurrent polling hooks: `useStadiumData(3000)` and `useAutoAnalysis(8000)`.
   - Modify the custom hooks (or combine them) so they use a single unified timer/polling mechanism or synchronize requests to minimize redundant API requests.
6. Implement Lazy Loading:
   - Code-split heavy views like `AuthPage`, `ProfileView`, and `AICommandPanel` using `React.lazy` and `Suspense` inside `App.jsx` to optimize page initial load performance.
7. Run the frontend build `npm run build` and ensure everything builds cleanly and Vitest/Jest tests pass.
MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work.
