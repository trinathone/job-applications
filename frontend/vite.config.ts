import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        // SSE needs streaming — disable buffering
        configure: (proxy) => {
          proxy.on("proxyReq", (_, req) => {
            if (req.url?.includes("/stream") || req.url?.includes("/tailor")) {
              // Let Vite proxy stream without buffering
            }
          });
        },
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
