# CrowdPulse AI — Score-Maximization Plan

Goal: raise every evaluation parameter toward its ceiling for the FIFA World Cup 2026
stadium-operations brief, **without breaking the working demo** (109 tests + live Cloud Run).
Guardrail after every phase: `npm run typecheck` + `npm test` (18 unit + 91 e2e) stay green,
and `frontend` builds clean.

| # | Parameter | Impact | Baseline | Target |
|---|-----------|--------|----------|--------|
| 1 | Problem-Statement Alignment | High | 72 | 90+ |
| 2 | Code Quality | High | 84 | 90+ |
| 3 | Security | Medium | 75 | 90+ |
| 4 | Testing | Medium | 80 | 92+ |
| 5 | Efficiency | Medium | 74 | 90+ |
| 6 | Accessibility | Low | 82 | 92+ |

---

## 1. Problem-Statement Alignment (High) — biggest driver

**Gap:** themed as a *cricket* stadium (Narendra Modi Stadium; "cricket stadium" in the AI
prompt); no multilingual assistance; staff-only (no fan surface); missing FIFA framing.

**Changes**
- [ ] `state.js`: venue → **MetLife Stadium — New York/New Jersey** (FIFA 2026 final venue),
  capacity 82,500; rename cricket-flavored zones (`East/West Pavilion` → `East/West Stand`).
- [ ] `ai.js`: system prompt → "FIFA World Cup 2026 football (soccer) match"; add a
  **fan-assistance** capability (navigation, gates, accessibility, safety) so it serves fans
  *and* staff; keep the directionMap in sync with renamed zones.
- [ ] **Multilingual AI assistance** (a named brief domain): `language` param on
  `POST /api/agent/query`, validated against `SUPPORTED_LANGUAGES`; Gemini instructed to
  reply in that language. Frontend language selector in the AI Command Panel.
- [ ] `TopBar.jsx`: football display labels (Pre-Match / Kick-Off / Half-Time / Full-Time)
  over the existing status values (keep values → no test churn).
- [ ] Fix stale model label "Gemini 2.0 Flash" → "Gemini 2.5 Flash" (matches `GEMINI_MODEL`).
- [ ] Docs (`README.md`) retitled to FIFA framing; update `e2e` venue assertion.

**Verify:** unit test for `buildSystemPrompt(state, language)`; live agent reply in a 2nd language.

## 2. Code Quality (High)

**Gap:** hand-rolled JWT; frontend less rigorous than backend; stale references.
- [ ] Replace custom JWT with the vetted **`jose`** library (standard `exp` in seconds);
  update coupled tests. (Addresses Security too.)
- [ ] Centralize shared enums/labels (match phases, languages) to kill magic strings.
- [ ] Add a frontend lint/`tsc`-check-friendly structure; keep components single-purpose.
- [ ] Refresh docs so README/pitch match the shipped model + FIFA framing.

**Verify:** `tsc --noEmit` green; all tests green after the jose swap.

## 3. Security (Medium)

**Gap:** `POST /api/auth/token` issues a JWT with **no credential check**; mutations gate only
on "a valid token," not role; public service.
- [ ] `requireClearance(minLevel)` middleware + a clearance-rank map in config.
  - reset → Stadium Director; match-status & gate control → Operations Lead+; incident
    resolve → any authenticated. (Demo Director/Chief still pass → no e2e breakage.)
- [ ] `DEMO_LOGIN_ENABLED` env flag (default true): when false, credential-free token
  issuance is disabled (production lock-down path). Documented in `docs/SECURITY.md`.
- [ ] Add tests: low-clearance token → 403 on a privileged mutation (also lifts Testing).
- [ ] Keep existing hardening (helmet CSP, dual rate-limit, validation, RBAC allow-list, jose).

**Verify:** new 403 tests pass; Director token still mutates.

## 4. Testing (Medium)

**Gap:** zero frontend tests; no CI.
- [ ] Add **Vitest + @testing-library/react + jsdom**; tests for `AlertBanner`, `MetricCards`,
  the `useStadiumData` polling hook, and the language selector.
- [ ] Add **GitHub Actions CI** (`.github/workflows/ci.yml`): backend typecheck + unit + e2e,
  frontend test + build.
- [ ] New backend authorization tests (from §3).

**Verify:** `npm test` (frontend) green; CI workflow validates.

## 5. Efficiency (Medium)

**Gap:** Firestore write every 3 s tick; single 724 KB JS chunk.
- [ ] `SIM.PERSIST_EVERY_TICKS` (default 10 → ~30 s): simulation persists periodically, not
  every tick; mutations still persist immediately. ~10× fewer steady-state writes.
- [ ] `vite.config.js` `manualChunks`: split `react`, `recharts`, `firebase` vendors; lazy-load
  `ProfileView`. Cuts the main bundle well under the 500 KB warning.

**Verify:** build output shows split chunks; e2e simulation-integrity test still green.

## 6. Accessibility (Low)

**Gap:** English-only; real-time updates need polite announcement.
- [ ] Skip-to-content link + `<main id>` landmark in `App.jsx`.
- [ ] `aria-live="polite"` on the alert banner / auto-analysis so updates are announced
  without flooding; verify status menus are keyboard-complete.
- [ ] Multilingual AI (from §1) directly improves inclusive, usable design.

**Verify:** keyboard-only pass; axe-style spot check on the live URL.

---

## Sequencing
A. Alignment → B. Security → C. Efficiency → D. Testing → E. Accessibility → F. Code-quality/jose.
Verify after each. Then commit, push, redeploy to Cloud Run, and re-check the live URL.

---

## Status — implemented this pass

- **Alignment ✅** FIFA World Cup 2026 re-theme (MetLife Stadium, football system
  prompt, `East/West Stand` zones, football status labels); multilingual AI in 8
  languages (`SUPPORTED_LANGUAGES` + `language` param + panel selector); fan-facing
  assistance in the prompt; stale "Gemini 2.0" → 2.5 everywhere.
- **Security ✅** `requireClearance()` tiered authorization on mutations (reset →
  Director; gate/match-status → Ops Lead+); `DEMO_LOGIN_ENABLED` lockdown flag;
  new 403 unit + e2e tests. RBAC allow-list + hardening retained.
- **Efficiency ✅** `SIM.PERSIST_EVERY_TICKS` batches Firestore writes ~10×; Vite
  `manualChunks` split the bundle (main app **724 KB → ~36 KB**; charts/firebase/
  react isolated; >500 KB warning gone).
- **Testing ✅** Vitest + Testing Library (9 frontend tests) + GitHub Actions CI
  (`.github/workflows/ci.yml`) running backend typecheck/unit/e2e + frontend test/build.
  Backend suite grew to **20 unit + 92 e2e**.
- **Accessibility ✅** Baseline was already strong (skip link, `main` landmark,
  `aria-live` alert/status regions, 139 ARIA usages); multilingual selector adds
  inclusivity. Language `<select>` is labelled.
- **Code Quality ✅ (jose ⏸ deferred)** Docs now match the shipped model + FIFA
  framing; API table corrected; shared enums centralized. Swapping the (correct,
  tested, constant-time) custom JWT for `jose` is **deferred** to protect the
  green 100+ test suite; documented as the production hardening path in SECURITY.md.

Guardrail held: `tsc --noEmit` + 20 unit + 92 e2e + 9 frontend tests all green;
frontend builds clean.
