# Walkthrough — Firestore Persistence, Custom Auth & Profile Portal

We have successfully integrated **Google Cloud Firestore** for real-time stadium data persistence, implemented a custom **Premium Authentication and Profile Customization portal** with Google Sign-In, and redeployed the **CrowdPulse AI** command center to **Google Cloud Run** in the **`asia-south1` (Mumbai, India)** region.

---

## 🚀 Deployed URL

> **Production Application:** [https://crowdpulse-ai-760399447766.asia-south1.run.app](https://crowdpulse-ai-760399447766.asia-south1.run.app)
> **Active Region:** `asia-south1` (Mumbai, India) — co-locating compute and data to ensure minimal latency for Indian cricket venues and fans!

---

## 🏗️ Premium Features Added

### 1. Custom Glassmorphism Auth Portal (`AuthPage.jsx`)
*   **Deep radial gradients** and blur borders matching the dark-mode stadium dashboard aesthetics.
*   **Credentials Auth**: Clean form tabs for quick switching between "Sign In" and "Create Account" with built-in form validation.
*   **Continue with Google**: A beautifully integrated branded button with smooth OAuth loading and entry animations.
*   **One-Click Demo Logins**: Designed specifically for the Google Bengaluru Hackathon judges! Allows logging in immediately as **Abhiraj Singh (Stadium Director)** or **Vikram Malhotra (Security Chief)** with pre-configured high-level permission sets with a single click.

### 2. Profile Management Center (`ProfileView.jsx`)
*   **Security Clearance Status**: Live tracking of user clearance (e.g. `Level-5 (Super-Admin)` vs. `Level-2 (Standard-Write)`), registration date, and telemetry activity log counts.
*   **Customization**: Live updates for display names, stadium roles, and password overrides.
*   **Stadium Avatars**: Emojis avatar selections (`👔`, `👮`, `📊`, `🌐`) that immediately update globally in the sidebar.
*   **Session Termination**: Secure logout option with slide-up screen transitions.

---

## 🏗️ Architecture Improvements

### 1. Persistent State with Cloud Firestore
*   **Volatile to Persistent**: Transitioned the MVP from a purely volatile in-memory simulation to a highly scalable stateless backend powered by Cloud Firestore.
*   **Dual Mode Support**: Designed a seamless hybrid layer:
    *   **Local fallback**: Automatically detects if it is running locally without GCP credentials and defaults to a local in-memory simulation (zero setup friction!).
    *   **Production zero-config**: Automatically connects to the Native Mode Cloud Firestore database `(default)` on GCP via standard IAM service account discovery.
*   **Optimized Performance**: Tick-based simulation updates and API-driven events are written asynchronously to Firestore using document merges to prevent blocking the Node/Express event loop.

### 2. Files Modified and Added

*   **`frontend/src/firebase.js` [NEW]**: Initializes the Firebase Web App and sets up the client-side authentication provider.
*   **`frontend/src/context/AuthContext.jsx` [NEW]**: Central authentication context managing sessions, registrations, real Google OAuth redirect popup integrations, and user list persistence in `localStorage`.
*   **`frontend/src/components/AuthPage.jsx` [NEW]**: Stunning login and registration interface.
*   **`frontend/src/components/ProfileView.jsx` [NEW]**: Detailed profile customizer, role manager, and clearance stats board.
*   **`frontend/src/components/Sidebar.jsx`**: Integrated a clean profile card at the bottom which dynamically links to the `Profile View`.
*   **`frontend/src/App.jsx`**: Wrapped application inside `AuthProvider` to enforce login walls, and set up routing for the `Profile View`.
*   **`backend/package.json`**: Added `@google-cloud/firestore` package.
*   **`backend/db.js` [NEW]**: Modular database connector. Handles Firestore initialization, fallback, loading (`getStadiumState`), and saving (`saveStadiumState`).
*   **`backend/server.js`**: Loaded the persistent stadium state on boot and synchronized all updates (simulation ticks and API control routes) back to Firestore.
*   **`cloudbuild.yaml`**: Adjusted deploy configuration to standardise on `asia-south1`.
*   **`.gcloudignore` [NEW]**: Optimised deployment payload from **49.1 MiB** down to **845 KiB** (a 98% file reduction) by excluding massive local node modules and build tooling caches.
*   **`README.md`**: Updated documentation to match the `asia-south1` commands.
