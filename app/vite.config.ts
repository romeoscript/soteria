import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Solana web3, circomlibjs (blake-hash) and snarkjs reference Node globals
// (Buffer/process/global) at module load — polyfill them for the browser.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
});
