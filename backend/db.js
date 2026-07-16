import { Firestore } from "@google-cloud/firestore";

/**
 * The Firestore database instance. Will be null if Firestore is not initialized/disabled.
 * @type {import('@google-cloud/firestore').Firestore|null}
 */
let db = null;

/**
 * Flag indicating whether Firestore is active and successfully initialized.
 * @type {boolean}
 */
let useFirestore = false;

/**
 * Local in-memory backup state of the stadium to serve immediately in case of read failures or when Firestore is disabled.
 * @type {Object|null}
 */
let localMemoryState = null;

// Resolve the target GCP project from the environment, falling back to the
// deployment default. On Cloud Run the client also picks up credentials
// automatically from the runtime service account.
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "promptwar-501405";

try {
  db = new Firestore({ projectId: PROJECT_ID });
  useFirestore = true;
  console.log(`🔥 Firestore successfully initialized for project ${PROJECT_ID}.`);
} catch (error) {
  console.warn(
    "⚠️ Firestore client initialization failed. Falling back to In-Memory mode.",
    error.message
  );
  useFirestore = false;
}

/**
 * The Firestore document path used to store the stadium state.
 * @type {string}
 */
const DOC_PATH = "stadiums/NarendraModiStadium";

/**
 * Loads the stadium state from Firestore.
 * If Firestore is disabled or fails, falls back to the in-memory state.
 * If the document does not exist in Firestore, initializes it with defaultState.
 * @param {Object} defaultState - The initial state to use as default.
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
      console.log(`📝 Document ${DOC_PATH} does not exist. Initializing with default state...`);
      await docRef.set(localMemoryState);
      return localMemoryState;
    }

    const dbState = doc.data();

    // Ensure all critical root fields exist (compatibility layer)
    const mergedState = { ...localMemoryState, ...dbState };
    localMemoryState = mergedState;
    return mergedState;
  } catch (error) {
    console.warn(
      "⚠️ Error reading stadium state from Firestore. Falling back to local memory store:",
      error.message
    );
    return localMemoryState;
  }
}

/**
 * Saves the stadium state to Firestore.
 * Updates localMemoryState first, then writes to Firestore asynchronously.
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
    // Merge-write so partial updates never clobber unrelated fields. Callers
    // typically invoke this without awaiting, keeping API responses fast while
    // persistence completes in the background.
    await docRef.set(localMemoryState, { merge: true });
  } catch (error) {
    console.warn("⚠️ Error writing stadium state to Firestore:", error.message);
  }
}
