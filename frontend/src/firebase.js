import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

// --- Firebase Web App Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCC_sAXnoVICulVd-INPfEQpoJXf6vQVSQ",
  authDomain: "crowdpulseai-497205.firebaseapp.com",
  projectId: "crowdpulseai-497205",
  storageBucket: "crowdpulseai-497205.firebasestorage.app",
  messagingSenderId: "760399447766",
  appId: "1:760399447766:web:d260366621203d2c67eb77",
  measurementId: "G-L92WLQMN1J"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Analytics
export const analytics = getAnalytics(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Custom configurations for Google Sign-In
googleProvider.setCustomParameters({
  prompt: 'select_account' // Forces the account chooser to appear every time
});

export default app;
