/**
 * @file firebase.js
 * @description Configures and initializes Firebase services for the CrowdPulse frontend application.
 * Currently initializes the core Firebase App and Firebase Authentication service.
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

/**
 * Firebase Web App Configuration options.
 * Includes credentials and identifiers for the Firebase project.
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
  apiKey: "AIzaSyCC_sAXnoVICulVd-INPfEQpoJXf6vQVSQ",
  authDomain: "crowdpulseai-497205.firebaseapp.com",
  projectId: "crowdpulseai-497205",
  storageBucket: "crowdpulseai-497205.firebasestorage.app",
  messagingSenderId: "760399447766",
  appId: "1:760399447766:web:d260366621203d2c67eb77",
  measurementId: "G-L92WLQMN1J",
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

/**
 * The initialized Firebase Authentication service instance.
 * @type {import('firebase/auth').Auth}
 */
export const auth = getAuth(app);

