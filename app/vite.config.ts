import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Buffer/global polyfills are commonly needed for Solana libs in the browser.
export default defineConfig({
  plugins: [react()],
  define: { "global": "globalThis" },
  resolve: { alias: { stream: "stream-browserify" } },
});
