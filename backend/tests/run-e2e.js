import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const rootDir = join(__dirname, "..");

const rateLimitPath = join(rootDir, "node_modules", "express-rate-limit", "dist", "index.mjs");
const rateLimitBackupPath = rateLimitPath + ".bak";

const mockRateLimitCode = `
export class MemoryStore {
  constructor() {}
}

export function rateLimit(options = {}) {
  const limit = options.max || 120;
  let remaining = limit;
  const middleware = (req, res, next) => {
    remaining--;
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + 60000) / 1000).toString());
    next();
  };
  middleware.resetKey = () => {};
  middleware.getKey = () => {};
  return middleware;
}

export default rateLimit;
`;

async function main() {
  // Backup and Mock Rate Limiter
  if (existsSync(rateLimitPath)) {
    if (!existsSync(rateLimitBackupPath)) {
      console.log("📦 Creating backup of express-rate-limit...");
      writeFileSync(rateLimitBackupPath, readFileSync(rateLimitPath));
    }
    console.log("⚡ Swapping express-rate-limit with test mock...");
    writeFileSync(rateLimitPath, mockRateLimitCode);
  }

  let server;
  try {
    console.log("🚀 Starting CrowdPulse AI test server...");
    server = spawn("node", ["server.js"], {
      cwd: rootDir,
      env: {
        ...process.env,
        PORT: "8085",
        GEMINI_API_KEY: "", // ensure fallback is tested
      },
    });

    server.stderr.on("data", (data) => {
      console.error(`[Server Error]: ${data.toString().trim()}`);
    });

    // Poll health endpoint
    const start = Date.now();
    let online = false;
    while (Date.now() - start < 15000) {
      try {
        const res = await fetch("http://localhost:8085/health");
        if (res.ok) {
          online = true;
          break;
        }
      } catch (e) {
        // Ignored
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!online) {
      console.error("❌ Server failed to start on port 8085 in 15 seconds.");
      if (server) server.kill();
      restoreRateLimit();
      process.exit(1);
    }

    console.log("✅ Server online! Running E2E tests...");

    const tests = spawn("node", ["--test", "tests/e2e.test.js"], {
      cwd: rootDir,
      env: {
        ...process.env,
        PORT: "8085",
      },
      stdio: "inherit",
    });

    tests.on("close", (code) => {
      cleanup(server, code);
    });
  } catch (err) {
    console.error("Fatal test runner error:", err);
    cleanup(server, 1);
  }
}

function restoreRateLimit() {
  if (existsSync(rateLimitBackupPath)) {
    console.log("🧹 Restoring original express-rate-limit...");
    writeFileSync(rateLimitPath, readFileSync(rateLimitBackupPath));
  }
}

function cleanup(server, code) {
  console.log(`\n🧹 Cleaning up: killing test server (PID: ${server?.pid})...`);
  if (server) server.kill();
  restoreRateLimit();

  if (code === 0) {
    console.log("✨ All E2E tests passed successfully!");
  } else {
    console.error(`❌ E2E tests failed with exit code ${code}`);
  }
  process.exit(code);
}

main().catch((err) => {
  console.error("Unhandled main error:", err);
  restoreRateLimit();
  process.exit(1);
});
