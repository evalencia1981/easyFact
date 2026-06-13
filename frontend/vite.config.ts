import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El frontend llama a /api/* y Vite lo redirige al backend FastAPI (puerto 8000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
