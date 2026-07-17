/**
 * @file db.js
 * @description Firestore persistence layer for the shared stadium state. Wraps
 * the Google Cloud Firestore client with a graceful in-memory fallback so the
 * app keeps serving from the last known state when Firestore is unconfigured or
 * unreachable. All reads and writes of persisted state go through this module.
 * @module db
 */

import { Firestore } from "@google-cloud/firestore";

import { logger } from "./src/logger.js";

/**
 * The Firestore database instance, or null when persistence is disabled or the
 * client failed to initialize.
 * @type {import('@google-cloud/firestore').Firestore|null}
 */
let db = null;

/**
 * Whether Firestore is active and successfully initialized. When false, every
 * operation transparently falls back to the in-memory state.
 * @type {boolean}
 */
let useFirestore = false;

/**
 * Last-known stadium state held in memory. Serves reads immediately and backs
 * the fallback path when Firestore is disabled or a read/write fails.
 * @type {Object|null}
 */
let localMemoryState = null;

// Resolve the target GCP project from the environment. When unset (e.g. on
// Cloud Run), the Firestore client auto-detects both the project and its
// credentials from the runtime service account / metadata server. No project
// identifier is hardcoded here.
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || undefined;

try {
  db = PROJECT_ID ? new Firestore({ projectId: PROJECT_ID }) : new Firestore();
  useFirestore = true;
  logger.info("firestore.initialized", { project: PROJECT_ID || "auto-detected" });
} catch (error) {
  // Initialization can fail when credentials are absent locally; degrade to the
  // in-memory store rather than crashing the server on startup.
  useFirestore = false;
  logger.warn("firestore.init_failed", { detail: error.message });
}

/**
 * The Firestore document path used to store the stadium state.
 * @type {string}
 */
const DOC_PATH = "stadiums/NarendraModiStadium";

/**
 * Loads the stadium state from Firestore, falling back to the in-memory copy
 * when Firestore is disabled or the read fails. Seeds the document with
 * `defaultState` the first time it is found missing.
 * @param {Object} defaultState - The baseline state used to seed the document.
 * @returns {Promise<Object>} The current stadium state.
 */
export async function getStadiumState(defaultState) {
  if (!localMemoryState) {
    localMemoryState = JSON.parse(JSON.stringify(defaultState));
  }

  if (!useFirestore) {
    return localMemoryState;
  }

  try {
    const docRef = db.doc(DOC_PATH);
    const doc = await docRef.get();

    if (!doc.exists) {
      logger.info("firestore.document_seeded", { docPath: DOC_PATH });
      await docRef.set(localMemoryState);
      return localMemoryState;
    }

    const dbState = doc.data();
    // Merge the persisted document over the in-memory defaults so any root
    // fields added after the document was first written still exist.
    const mergedState = { ...localMemoryState, ...dbState };
    localMemoryState = mergedState;
    return mergedState;
  } catch (error) {
    logger.warn("firestore.read_failed", { detail: error.message });
    return localMemoryState;
  }
}

/**
 * Persists the stadium state to Firestore. Updates the in-memory copy first so
 * a subsequent failed write still leaves the latest state readable. The write
 * is a merge, so partial updates never clobber unrelated fields. Callers
 * typically invoke this without awaiting, keeping API responses fast while
 * persistence completes in the background.
 * @param {Object} state - The current stadium state to persist.
 * @returns {Promise<void>}
 */
export async function saveStadiumState(state) {
  localMemoryState = JSON.parse(JSON.stringify(state));

  if (!useFirestore) {
    return;
  }

  try {
    const docRef = db.doc(DOC_PATH);
    await docRef.set(localMemoryState, { merge: true });
  } catch (error) {
    logger.warn("firestore.write_failed", { detail: error.message });
  }
}
