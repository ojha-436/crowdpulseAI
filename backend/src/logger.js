/**
 * @file logger.js
 * @description Minimal structured (JSON) logger, replacing ad-hoc console.*
 * calls. Each line is a single JSON object carrying a `severity` field, which
 * Google Cloud Logging parses natively so logs are filterable by level in
 * production. The level threshold is controlled by the LOG_LEVEL env var.
 * @module logger
 */

/**
 * Numeric severity ordering used to filter messages below the configured level.
 * @type {Readonly<Record<string, number>>}
 */
const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });

/**
 * The active minimum level; messages below it are dropped. Defaults to "info".
 * @type {number}
 */
const THRESHOLD = LEVELS[(process.env.LOG_LEVEL || "info").toLowerCase()] ?? LEVELS.info;

/**
 * Writes a single structured log line to stdout.
 * @param {"debug"|"info"|"warn"|"error"} severity - Log severity.
 * @param {string} message - Human-readable event message.
 * @param {Object} [fields={}] - Additional structured context to attach.
 * @returns {void}
 */
function emit(severity, message, fields = {}) {
  if (LEVELS[severity] < THRESHOLD) return;
  const record = {
    severity: severity.toUpperCase(),
    time: new Date().toISOString(),
    message,
    ...fields,
  };
  process.stdout.write(`${JSON.stringify(record)}\n`);
}

/**
 * Structured logger with one method per severity. Prefer this over console.*
 * so every log line is machine-parseable and level-filterable.
 * @type {{
 *   debug: (message: string, fields?: Object) => void,
 *   info: (message: string, fields?: Object) => void,
 *   warn: (message: string, fields?: Object) => void,
 *   error: (message: string, fields?: Object) => void,
 * }}
 */
export const logger = {
  debug: (message, fields) => emit("debug", message, fields),
  info: (message, fields) => emit("info", message, fields),
  warn: (message, fields) => emit("warn", message, fields),
  error: (message, fields) => emit("error", message, fields),
};
