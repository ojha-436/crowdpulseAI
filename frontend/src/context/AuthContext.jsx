/**
 * @file AuthContext.jsx
 * @description Provides the authentication context, hooks, and helpers for user accounts.
 * Manages Google Sign-In via Firebase and local session state.
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase.js";

const AuthContext = createContext(null);

const DEFAULT_USERS = [
  {
    username: "abhiraj",
    email: "iamabhiraj8825@gmail.com",
    password: "password123",
    displayName: "Abhiraj Singh",
    role: "Stadium Director",
    avatar: "director",
    clearance: "Level-5 (Super-Admin)",
    commandsCount: 142,
    joinedDate: "May 2026",
  },
  {
    username: "security_chief",
    email: "security@crowdpulse.ai",
    password: "password123",
    displayName: "Vikram Malhotra",
    role: "Security Chief",
    avatar: "security",
    clearance: "Level-4 (Incident-Cmd)",
    commandsCount: 89,
    joinedDate: "May 2026",
  },
];

/**
 * Context provider that manages authentication state, session persistence,
 * and user profiles (both local credentials and Google OAuth users via Firebase).
 *
 * @component
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - Child components to be wrapped.
 * @returns {React.JSX.Element} The rendered Provider component.
 */
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize users in localStorage if not exists
    const storedUsers = localStorage.getItem("crowdpulse_users");
    let currentLocalUsers = DEFAULT_USERS;
    if (!storedUsers) {
      localStorage.setItem("crowdpulse_users", JSON.stringify(DEFAULT_USERS));
      setUsers(DEFAULT_USERS);
    } else {
      currentLocalUsers = JSON.parse(storedUsers);
      setUsers(currentLocalUsers);
    }

    // Remove getRedirectResult since we are strictly using signInWithPopup to prevent redirect loops.

    // Set up the Firebase Auth observer to automatically handle Google Sign-In and persistence
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Successful Google login detected!
        const email = firebaseUser.email || "operator@crowdpulse.ai";
        const username = email.split("@")[0];
        const displayName = firebaseUser.displayName || username;

        const googleUser = {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password: "google-oauth-managed",
          displayName: displayName,
          role: "Stadium Director", // default super admin
          avatar: "google",
          clearance: "Level-5 (Super-Admin)",
          commandsCount: 0,
          joinedDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        };

        try {
          const res = await fetch("/api/auth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: googleUser.username,
              role: googleUser.role,
              email: googleUser.email,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            googleUser.token = data.token;
            googleUser.role = data.role;
            googleUser.clearance = data.clearance;
          }
        } catch (e) {
          console.error("Failed to fetch auth token", e);
        }

        // Fetch latest users
        const latestStoredUsers = localStorage.getItem("crowdpulse_users");
        let localUsers = latestStoredUsers ? JSON.parse(latestStoredUsers) : DEFAULT_USERS;

        // Save Google operator profile to local users database if not exists
        const userExists = localUsers.some(
          (u) => u.email.toLowerCase() === googleUser.email.toLowerCase()
        );
        if (!userExists) {
          const googleUserToStore = { ...googleUser };
          const updatedUsers = [...localUsers, googleUserToStore];
          localStorage.setItem("crowdpulse_users", JSON.stringify(updatedUsers));
          setUsers(updatedUsers);
        }

        // Establish the active login session
        localStorage.setItem("crowdpulse_session", JSON.stringify(googleUser));
        setCurrentUser(googleUser);
      } else {
        // No Firebase user session. Look for any active local session (Google, email, or demo account)
        const activeSession = localStorage.getItem("crowdpulse_session");
        if (activeSession) {
          const parsedSession = JSON.parse(activeSession);
          if (!parsedSession.token) {
            try {
              const res = await fetch("/api/auth/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  username: parsedSession.username,
                  role: parsedSession.role,
                  email: parsedSession.email,
                }),
              });
              if (res.ok) {
                const data = await res.json();
                parsedSession.token = data.token;
                parsedSession.role = data.role;
                parsedSession.clearance = data.clearance;
                localStorage.setItem("crowdpulse_session", JSON.stringify(parsedSession));
              }
            } catch (e) {
              console.error("Failed to restore token on boot", e);
            }
          }
          setCurrentUser(parsedSession);
        } else {
          setCurrentUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Logs in a user using their email or username and password.
   * Fetches an authentication token from the backend.
   *
   * @param {string} emailOrUsername - The user's email address or username.
   * @param {string} password - The user's password.
   * @returns {Promise<Object>} A promise resolving to the logged-in user object.
   */
  const login = (emailOrUsername, password) => {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        const foundUser = users.find(
          (u) =>
            (u.email.toLowerCase() === emailOrUsername.toLowerCase() ||
              u.username.toLowerCase() === emailOrUsername.toLowerCase()) &&
            u.password === password
        );

        if (foundUser) {
          try {
            const res = await fetch("/api/auth/token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username: foundUser.username,
                role: foundUser.role,
                email: foundUser.email,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              foundUser.token = data.token;
              foundUser.role = data.role;
              foundUser.clearance = data.clearance;
            }
          } catch (e) {
            console.error("Failed to fetch auth token", e);
          }
          localStorage.setItem("crowdpulse_session", JSON.stringify(foundUser));
          setCurrentUser(foundUser);
          resolve(foundUser);
        } else {
          reject(new Error("Invalid email/username or password."));
        }
      }, 600); // realistic delay
    });
  };

  /**
   * Registers a new user with standard credentials and automatically logs them in.
   *
   * @param {string} username - The desired username.
   * @param {string} email - The user's email address.
   * @param {string} password - The user's password.
   * @returns {Promise<Object>} A promise resolving to the newly registered user object.
   */
  const register = (username, email, password) => {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        const emailExists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
        const userExists = users.some((u) => u.username.toLowerCase() === username.toLowerCase());

        if (emailExists) {
          reject(new Error("Email is already registered."));
          return;
        }
        if (userExists) {
          reject(new Error("Username is already taken."));
          return;
        }

        const newUser = {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password: password,
          displayName: username,
          role: "Operations Analyst",
          avatar: "ops",
          clearance: "Level-2 (Standard-Write)",
          commandsCount: 0,
          joinedDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        };

        try {
          const res = await fetch("/api/auth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: newUser.username,
              role: newUser.role,
              email: newUser.email,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            newUser.token = data.token;
            newUser.role = data.role;
            newUser.clearance = data.clearance;
          }
        } catch (e) {
          console.error("Failed to fetch auth token", e);
        }

        const updatedUsers = [...users, newUser];
        localStorage.setItem("crowdpulse_users", JSON.stringify(updatedUsers));
        setUsers(updatedUsers);

        // Auto-login after registration
        localStorage.setItem("crowdpulse_session", JSON.stringify(newUser));
        setCurrentUser(newUser);
        resolve(newUser);
      }, 800);
    });
  };

  /**
   * Updates the profile of the current authenticated user.
   *
   * @param {Object} updatedDetails - The updated profile fields.
   * @returns {Promise<Object>} A promise resolving to the updated user object.
   */
  const updateProfile = async (updatedDetails) => {
    let role = updatedDetails.role || currentUser.role;
    let clearance = updatedDetails.clearance || currentUser.clearance;
    let token = currentUser.token;

    if (updatedDetails.role && updatedDetails.role !== currentUser.role) {
      const res = await fetch("/api/auth/verify-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({ role: updatedDetails.role }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to verify role on backend");
      }

      const data = await res.json();
      role = data.role;
      clearance = data.clearance;
      token = data.token;
    }

    const mergedUser = { ...currentUser, ...updatedDetails, role, clearance, token };

    // Update current session
    localStorage.setItem("crowdpulse_session", JSON.stringify(mergedUser));
    setCurrentUser(mergedUser);

    // Update list of users
    const updatedUsers = users.map((u) =>
      u.email.toLowerCase() === currentUser.email.toLowerCase() ? mergedUser : u
    );
    localStorage.setItem("crowdpulse_users", JSON.stringify(updatedUsers));
    setUsers(updatedUsers);

    return mergedUser;
  };

  /**
   * Logs out the current user, clearing local session storage and signing out from Firebase.
   *
   * @returns {Promise<void>}
   */
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Firebase Google Sign-Out Error:", error);
    }
    localStorage.removeItem("crowdpulse_session");
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        login,
        register,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom React hook to access the current authentication context.
 *
 * @returns {Object} The authentication context value containing currentUser, login, register, updateProfile, and logout.
 * @throws {Error} If used outside of an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
