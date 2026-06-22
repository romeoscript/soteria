import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SolanaProviders } from "./providers";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SolanaProviders>
      <App />
    </SolanaProviders>
  </React.StrictMode>
);
