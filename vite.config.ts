import { defineConfig } from "vite";

export default defineConfig({
  root: "./tests/html",
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      "/session": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});