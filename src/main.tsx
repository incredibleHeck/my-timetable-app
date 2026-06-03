import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ProfileProvider } from "./contexts/ProfileContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/ui/Toast";
import { errorReporter } from "./services/errorReporter";
import "./index.css";

errorReporter.init();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <ProfileProvider>
          <App />
        </ProfileProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
