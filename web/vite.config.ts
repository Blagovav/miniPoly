import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

// Proxy target switches between Docker-compose ("api" hostname, resolved
// via the internal bridge) and local-dev ("localhost") via VITE_PROXY_HOST.
// The compose web service sets VITE_PROXY_HOST=api; bare `npm run dev` on
// the host machine picks up the localhost default.
const proxyHost = process.env.VITE_PROXY_HOST ?? "localhost";
const httpTarget = `http://${proxyHost}:3000`;
const wsTarget = `ws://${proxyHost}:3000`;

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    watch: { usePolling: true },
    // Allow the Caddy reverse-proxy upstream (`web:5173` from inside the
    // docker network) and the public hostname. Without this Vite 5.x
    // blocks any request whose Host header isn't localhost/127.* with a
    // 403 (DNS-rebinding protection added in 5.4) — broke prod 2026-05-05.
    allowedHosts: ["tapcade.online", "www.tapcade.online", "web", "localhost"],
    proxy: {
      "/api": { target: httpTarget, changeOrigin: true },
      "/ws": { target: wsTarget, ws: true },
    },
  },
});
