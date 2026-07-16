import { Firestore } from "@google-cloud/firestore";

let db = null;
let useFirestore = false;

// We will keep a local backup in memory to serve immediately in case of read failures or when Firestore is disabled
let localMemoryState = null;

try {
  // Try to initialize Firestore with the active project crowdpulseai-497205
  // It automatically picks up credentials when running on Cloud Run!
  db = new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || "promptwar-501405",
  });
  useFirestore = true;
  console.log("🔥 Firestore successfully initialized for project crowdpulseai-497205.");
} catch (error) {
  console.warn(
    "⚠️ Firestore client initialization failed. Falling back to In-Memory mode.",
    error.message
  );
  useFirestore = false;
}

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
    // Asynchronous write to Firestore to keep API responses super fast
    await docRef.set(localMemoryState, { merge: true });
  } catch (error) {
    console.warn("⚠️ Error writing stadium state to Firestore:", error.message);
  }
}
