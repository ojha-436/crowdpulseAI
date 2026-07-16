/**
 * @file main.jsx
 * @description Main entry point for the React frontend application.
 * Initializes and mounts the React root component with StrictMode.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
