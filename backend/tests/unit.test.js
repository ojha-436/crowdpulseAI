/**
 * @file unit.test.js
 * @description Fast, hermetic unit tests for the pure logic extracted into the
 * `src/` modules during the modular refactor. These run without a live server,
 * network, or GCP credentials (no function under test performs I/O), and
 * complement the black-box HTTP coverage in e2e.test.js.
 */

import { test, describe } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";

import {
  signToken,
  verifyToken,
  safeCompare,
  isValidString,
  isRoleAuthorized,
  clearanceForRole,
  authMiddleware,
  requireClearance,
} from "../src/auth.js";
import {
  executeToolCall,
  generateFallbackResponse,
  agentTools,
  buildSystemPrompt,
} from "../src/ai.js";
import { generateIncidentDescription } from "../src/simulation.js";
import { getInitialState, addAlert, stadiumState } from "../src/state.js";
import {
  ROLE_CLEARANCE,
  ROLE_RANK,
  VALID_ROLES,
  SIM,
  DEFAULT_ROLE,
  TOKEN_TTL_MS,
  JWT_SECRET,
} from "../src/config.js";

/** Forge a validly-signed token with arbitrary claims (for expiry testing). */
function forgeToken(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

describe("auth — JWT", () => {
  test("sign/verify round-trip preserves claims and stamps iat/exp", () => {
    const token = signToken({ username: "abhiraj", role: "Stadium Director" });
    const decoded = verifyToken(token);
    assert.strictEqual(decoded.username, "abhiraj");
    assert.strictEqual(decoded.role, "Stadium Director");
    assert.strictEqual(typeof decoded.iat, "number");
    assert.strictEqual(decoded.exp - decoded.iat, TOKEN_TTL_MS);
  });

  test("rejects malformed and tampered tokens", () => {
    assert.strictEqual(verifyToken("garbage"), null);
    assert.strictEqual(verifyToken("a.b.c"), null);
    const valid = signToken({ username: "u" });
    const [h, , s] = valid.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ username: "attacker" })).toString("base64url");
    assert.strictEqual(verifyToken(`${h}.${forgedBody}.${s}`), null);
  });

  test("rejects an expired but validly-signed token", () => {
    const past = Date.now() - 1000;
    const expired = forgeToken({ username: "u", iat: past - 1000, exp: past });
    assert.strictEqual(verifyToken(expired), null);
  });
});

describe("auth — helpers", () => {
  test("safeCompare is length-aware and value-correct", () => {
    assert.strictEqual(safeCompare("abc", "abc"), true);
    assert.strictEqual(safeCompare("abc", "abd"), false);
    assert.strictEqual(safeCompare("abc", "abcd"), false);
  });

  test("isValidString enforces non-empty and max length", () => {
    assert.strictEqual(isValidString("hello", 10), true);
    assert.strictEqual(isValidString("", 10), false);
    assert.strictEqual(isValidString("   ", 10), false);
    assert.strictEqual(isValidString("x".repeat(11), 10), false);
    assert.strictEqual(isValidString(123, 10), false);
  });

  test("isRoleAuthorized gates privileged roles via the configured allow-list", () => {
    // Allow-listed demo identities are elevated (username or email match).
    assert.strictEqual(isRoleAuthorized("Stadium Director", { username: "abhiraj" }), true);
    assert.strictEqual(
      isRoleAuthorized("Stadium Director", { email: "iamabhiraj8825@gmail.com" }),
      true
    );
    // An arbitrary Google account is NOT elevated — the blanket gmail/google
    // wildcard was removed, so unlisted identities cannot self-assign admin.
    assert.strictEqual(isRoleAuthorized("Stadium Director", { email: "a@gmail.com" }), false);
    assert.strictEqual(isRoleAuthorized("Stadium Director", { username: "googler" }), false);
    assert.strictEqual(isRoleAuthorized("Stadium Director", { username: "bob", email: "b@x.io" }), false);
    assert.strictEqual(isRoleAuthorized("Security Chief", { username: "security_chief" }), true);
    assert.strictEqual(isRoleAuthorized("Security Chief", { username: "nope" }), false);
    // Unprivileged roles need no allow-list entry.
    assert.strictEqual(isRoleAuthorized("Operations Analyst", {}), true);
  });

  test("clearanceForRole resolves and falls back to the default", () => {
    assert.strictEqual(clearanceForRole("Stadium Director"), ROLE_CLEARANCE["Stadium Director"]);
    assert.strictEqual(clearanceForRole("Nonexistent"), ROLE_CLEARANCE[DEFAULT_ROLE]);
  });

  test("authMiddleware blocks missing/invalid tokens and passes valid ones", () => {
    const makeRes = () => ({
      code: 0,
      body: null,
      status(c) {
        this.code = c;
        return this;
      },
      json(b) {
        this.body = b;
        return this;
      },
    });

    const res1 = makeRes();
    authMiddleware({ headers: {} }, res1, () => assert.fail("next should not run"));
    assert.strictEqual(res1.code, 401);

    const res2 = makeRes();
    authMiddleware({ headers: { authorization: "Bearer bad.token" } }, res2, () =>
      assert.fail("next should not run"),
    );
    assert.strictEqual(res2.code, 401);

    const token = signToken({ username: "u", role: "Operations Analyst" });
    const req = { headers: { authorization: `Bearer ${token}` } };
    let nextCalled = false;
    authMiddleware(req, makeRes(), () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.user.username, "u");
  });

  test("requireClearance enforces a minimum role rank", () => {
    const makeRes = () => ({
      code: 0,
      body: null,
      status(c) {
        this.code = c;
        return this;
      },
      json(b) {
        this.body = b;
        return this;
      },
    });

    const guard = requireClearance(ROLE_RANK["Operations Lead"]);

    // Under-cleared: an Operations Analyst (rank 2) is blocked with 403.
    const lowRes = makeRes();
    guard({ user: { role: "Operations Analyst" } }, lowRes, () =>
      assert.fail("next should not run for an under-cleared role"),
    );
    assert.strictEqual(lowRes.code, 403);

    // Missing role is treated as rank 0 and blocked.
    const noneRes = makeRes();
    guard({ user: {} }, noneRes, () => assert.fail("next should not run without a role"));
    assert.strictEqual(noneRes.code, 403);

    // Sufficiently-cleared: a Stadium Director (rank 5) passes through.
    let nextCalled = false;
    guard({ user: { role: "Stadium Director" } }, makeRes(), () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, true);
  });
});

describe("ai — tool execution (read-only) and fallback", () => {
  test("get_gate_status returns all gates or a single gate / error", () => {
    assert.ok(executeToolCall("get_gate_status", { gate_id: "all" }).gates);
    assert.ok(executeToolCall("get_gate_status", { gate_id: "North-A" }).gate);
    assert.ok(executeToolCall("get_gate_status", { gate_id: "Nope" }).error);
  });

  test("get_zone_density and get_weather_status return telemetry", () => {
    assert.ok(executeToolCall("get_zone_density", { zone_id: "all" }).zones);
    assert.ok(executeToolCall("get_weather_status", {}).condition);
  });

  test("get_crowd_analytics supports each metric", () => {
    assert.ok(executeToolCall("get_crowd_analytics", { metric: "occupancy_trend" }).utilizationPercent);
    assert.ok(executeToolCall("get_crowd_analytics", { metric: "gate_throughput" }).gates);
    assert.ok(executeToolCall("get_crowd_analytics", { metric: "zone_distribution" }).zones);
    assert.ok("critical" in executeToolCall("get_crowd_analytics", { metric: "risk_summary" }));
  });

  test("assign_ticket_gate picks a gate; unknown tool errors", () => {
    const out = executeToolCall("assign_ticket_gate", { zone: "North Stand", batch_size: 10 });
    assert.ok(out.assignedGate);
    assert.ok(executeToolCall("does_not_exist", {}).error);
  });

  test("generateFallbackResponse keys off the query intent", () => {
    assert.match(generateFallbackResponse("gate status"), /Gate Status/);
    assert.match(generateFallbackResponse("zone density"), /Zone Density/);
    assert.match(generateFallbackResponse("emergency"), /Active Incidents/);
    assert.match(generateFallbackResponse("hello"), /CrowdPulse AI Summary/);
  });

  test("agentTools is a well-formed schema list", () => {
    assert.strictEqual(agentTools.length, 8);
    for (const tool of agentTools) {
      assert.ok(tool.name && tool.description && tool.parameters);
    }
  });

  test("buildSystemPrompt is FIFA-themed and honors the requested language", () => {
    const state = getInitialState();
    const english = buildSystemPrompt(state);
    assert.match(english, /FIFA World Cup 2026/);
    assert.match(english, /in English/);
    // A non-default language instruction is injected verbatim.
    const spanish = buildSystemPrompt(state, "Spanish");
    assert.match(spanish, /in Spanish/);
    // Fan-facing assistance is part of the assistant's remit.
    assert.match(english, /[Ff]ans/);
  });
});

describe("simulation & state", () => {
  test("generateIncidentDescription covers known and unknown types", () => {
    assert.match(generateIncidentDescription({ type: "medical", zone: "VIP Lounge" }), /Medical/);
    assert.match(generateIncidentDescription({ type: "security", zone: "Gate 1" }), /Security/);
    assert.strictEqual(
      generateIncidentDescription({ type: "??", zone: "X" }),
      "Unclassified incident reported.",
    );
  });

  test("getInitialState builds 12 gates and 8 zones", () => {
    const s = getInitialState();
    assert.strictEqual(Object.keys(s.gates).length, 12);
    assert.strictEqual(Object.keys(s.zones).length, 8);
    assert.strictEqual(s.capacity, 82500);
  });

  test("addAlert prepends and caps history at the configured maximum", () => {
    const before = stadiumState.alerts.length;
    addAlert({ id: "t", type: "test", message: "hi", timestamp: Date.now(), severity: "low" });
    assert.ok(stadiumState.alerts.length >= Math.min(before + 1, SIM.MAX_ALERT_HISTORY));
    assert.ok(stadiumState.alerts.length <= SIM.MAX_ALERT_HISTORY);
  });
});

describe("config invariants", () => {
  test("roles and simulation constants are sane", () => {
    assert.deepStrictEqual(VALID_ROLES, Object.keys(ROLE_CLEARANCE));
    assert.strictEqual(VALID_ROLES.length, 4);
    assert.strictEqual(SIM.TICK_INTERVAL_MS, 3000);
    assert.ok(SIM.DENSITY_CRITICAL > SIM.DENSITY_HIGH);
    assert.ok(SIM.DENSITY_HIGH > SIM.DENSITY_MEDIUM);
  });
});
