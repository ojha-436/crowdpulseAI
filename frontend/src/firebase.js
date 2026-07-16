/**
 * @file firebase.js
 * @description Configures and initializes Firebase services for the CrowdPulse frontend application.
 * Currently initializes the core Firebase App and Firebase Authentication service.
 *
 * NOTE ON SECRECY: Firebase web configuration values (including the API key) are
 * public identifiers by design — they are shipped in the browser bundle and are
 * NOT secrets. They are read from build-time environment variables here only to
 * keep them out of source control. Real protection comes from Firebase Security
 * Rules and from restricting the API key to allowed domains in the Google Cloud
 * Console (APIs & Services → Credentials → Application restrictions).
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

/**
 * Firebase Web App Configuration options, sourced from Vite build-time
 * environment variables (VITE_FIREBASE_*). Define these in `frontend/.env`
 * for local development; they are injected as build args during the container
 * build for production. See `frontend/.env.example` for the required keys.
 * @type {Object}
 * @property {string} apiKey - The application API key.
 * @property {string} authDomain - The authentication domain.
 * @property {string} projectId - The Firebase project identifier.
 * @property {string} storageBucket - The storage bucket name.
 * @property {string} messagingSenderId - The sender ID for cloud messaging.
 * @property {string} appId - The unique Firebase application identifier.
 * @property {string} measurementId - The Google Analytics measurement identifier.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Fail fast with a clear message if the build was not given its config, rather
// than surfacing a cryptic Firebase SDK error at runtime.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    "Firebase configuration is missing. Ensure VITE_FIREBASE_* environment variables are set at build time (see frontend/.env.example)."
  );
}

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

/**
 * The initialized Firebase Authentication service instance.
 * @type {import('firebase/auth').Auth}
 */
export const auth = getAuth(app);
