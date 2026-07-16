import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El frontend llama a /api/* y Vite lo redirige al backend FastAPI (puerto 8000).
// BACKEND_PORT permite moverlo si el 8000 ya está ocupado por otro servicio.
const backendPort = process.env.BACKEND_PORT ?? "8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
});
