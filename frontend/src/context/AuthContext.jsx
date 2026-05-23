import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase.js';

const AuthContext = createContext(null);

const DEFAULT_USERS = [
  {
    username: 'abhiraj',
    email: 'iamabhiraj8825@gmail.com',
    password: 'password123',
    displayName: 'Abhiraj Singh',
    role: 'Stadium Director',
    avatar: 'director',
    clearance: 'Level-5 (Super-Admin)',
    commandsCount: 142,
    joinedDate: 'May 2026',
  },
  {
    username: 'security_chief',
    email: 'security@crowdpulse.ai',
    password: 'password123',
    displayName: 'Vikram Malhotra',
    role: 'Security Chief',
    avatar: 'security',
    clearance: 'Level-4 (Incident-Cmd)',
    commandsCount: 89,
    joinedDate: 'May 2026',
  },
];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize users in localStorage if not exists
    const storedUsers = localStorage.getItem('crowdpulse_users');
    let currentLocalUsers = DEFAULT_USERS;
    if (!storedUsers) {
      localStorage.setItem('crowdpulse_users', JSON.stringify(DEFAULT_USERS));
      setUsers(DEFAULT_USERS);
    } else {
      currentLocalUsers = JSON.parse(storedUsers);
      setUsers(currentLocalUsers);
    }

    // Set up the Firebase Auth observer to automatically handle Google Sign-In and persistence
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Successful Google login detected!
        const email = firebaseUser.email || 'operator@crowdpulse.ai';
        const username = email.split('@')[0];
        const displayName = firebaseUser.displayName || username;

        const googleUser = {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password: 'google-oauth-managed',
          displayName: displayName,
          role: 'Stadium Director', // default super admin
          avatar: 'google',
          clearance: 'Level-5 (Super-Admin)',
          commandsCount: 0,
          joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        };

        // Fetch latest users
        const latestStoredUsers = localStorage.getItem('crowdpulse_users');
        let localUsers = latestStoredUsers ? JSON.parse(latestStoredUsers) : DEFAULT_USERS;

        // Save Google operator profile to local users database if not exists
        const userExists = localUsers.some((u) => u.email.toLowerCase() === googleUser.email.toLowerCase());
        if (!userExists) {
          const updatedUsers = [...localUsers, googleUser];
          localStorage.setItem('crowdpulse_users', JSON.stringify(updatedUsers));
          setUsers(updatedUsers);
        }

        // Establish the active login session
        localStorage.setItem('crowdpulse_session', JSON.stringify(googleUser));
        setCurrentUser(googleUser);
      } else {
        // No Firebase user session. Look for local email/password or hackathon demo account session
        const activeSession = localStorage.getItem('crowdpulse_session');
        if (activeSession) {
          const parsedSession = JSON.parse(activeSession);
          // If the local session is a Google account, but Firebase is signed out, terminate session
          if (parsedSession.password === 'google-oauth-managed') {
            localStorage.removeItem('crowdpulse_session');
            setCurrentUser(null);
          } else {
            setCurrentUser(parsedSession);
          }
        } else {
          setCurrentUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (emailOrUsername, password) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const foundUser = users.find(
          (u) =>
            (u.email.toLowerCase() === emailOrUsername.toLowerCase() ||
              u.username.toLowerCase() === emailOrUsername.toLowerCase()) &&
            u.password === password
        );

        if (foundUser) {
          localStorage.setItem('crowdpulse_session', JSON.stringify(foundUser));
          setCurrentUser(foundUser);
          resolve(foundUser);
        } else {
          reject(new Error('Invalid email/username or password.'));
        }
      }, 600); // realistic delay
    });
  };

  const register = (username, email, password) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const emailExists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
        const userExists = users.some((u) => u.username.toLowerCase() === username.toLowerCase());

        if (emailExists) {
          reject(new Error('Email is already registered.'));
          return;
        }
        if (userExists) {
          reject(new Error('Username is already taken.'));
          return;
        }

        const newUser = {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password: password,
          displayName: username,
          role: 'Operations Analyst',
          avatar: 'ops',
          clearance: 'Level-2 (Standard-Write)',
          commandsCount: 0,
          joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        };

        const updatedUsers = [...users, newUser];
        localStorage.setItem('crowdpulse_users', JSON.stringify(updatedUsers));
        setUsers(updatedUsers);

        // Auto-login after registration
        localStorage.setItem('crowdpulse_session', JSON.stringify(newUser));
        setCurrentUser(newUser);
        resolve(newUser);
      }, 800);
    });
  };

  const loginWithGoogle = async () => {
    try {
      // Simply trigger standard Firebase popup. The observer hook catches and synchronizes state!
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Firebase Google Auth Error:", error);
      throw error;
    }
  };

  const updateProfile = (updatedDetails) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mergedUser = { ...currentUser, ...updatedDetails };
        
        // Update current session
        localStorage.setItem('crowdpulse_session', JSON.stringify(mergedUser));
        setCurrentUser(mergedUser);

        // Update list of users
        const updatedUsers = users.map((u) => 
          u.email.toLowerCase() === currentUser.email.toLowerCase() ? mergedUser : u
        );
        localStorage.setItem('crowdpulse_users', JSON.stringify(updatedUsers));
        setUsers(updatedUsers);

        resolve(mergedUser);
      }, 500);
    });
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Firebase Google Sign-Out Error:", error);
    }
    localStorage.removeItem('crowdpulse_session');
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        login,
        register,
        loginWithGoogle,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
