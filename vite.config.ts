import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

const mode = process.env["NODE_ENV"] === "production" ? "production" : "development";
Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

export default defineConfig({
  // Expose VITE_* and AI_* to the client (SPA — keys will be in the browser bundle).
  envPrefix: ["VITE_", "AI_"],
  resolve: {
    alias: { "@": path.resolve("./src") },
  },
  server: {
    host: "::",
    port: 8080,
    fs: { allow: [path.resolve(".")] },
    watch: {
      ignored: ["**/data/**", "**/src/lib/catalog.json"],
    },
  },
  preview: {
    port: 8080,
  },
  json: {
    stringify: true,
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    viteReact(),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
  ],
});
