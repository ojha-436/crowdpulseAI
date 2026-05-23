import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// --- Firebase Web App Configuration ---
// Note: You can replace these placeholders with your actual values from:
// Firebase Console > Project Settings > General > Your Apps > Web SDK Configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD-YOUR-API-KEY-HERE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "crowdpulseai-497205.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "crowdpulseai-497205",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "crowdpulseai-497205.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "760399447766",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:760399447766:web:1234567890abcdef"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Custom configurations for Google Sign-In
googleProvider.setCustomParameters({
  prompt: 'select_account' // Forces the account chooser to appear every time
});

export default app;
