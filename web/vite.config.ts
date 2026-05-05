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
  // server config below applies only to `npm run dev` — production
  // builds via `npm run build` ignore it. allowedHosts was needed when
  // we shipped vite-dev to prod; now nginx serves the static dist, so
  // the dev server only ever runs locally on a developer's machine.
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    watch: { usePolling: true },
    proxy: {
      "/api": { target: httpTarget, changeOrigin: true },
      "/ws": { target: wsTarget, ws: true },
    },
  },
});
