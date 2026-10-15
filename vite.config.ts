import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Charge le .env dans process.env pour les server functions (AI_*),
// sans écraser les secrets déjà injectés par la plateforme d'hébergement.
const mode = process.env["NODE_ENV"] === "production" ? "production" : "development";
Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

export default defineConfig({
  server: {
    port: 8080,
    fs: { allow: [path.resolve(".")] },
    // data/ holds scraped JSON leftovers — watching them freezes Vite SSR
    watch: {
      ignored: ["**/data/**", "**/src/lib/catalog.json"],
    },
  },
  json: {
    stringify: true,
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
    }),
    // react's vite plugin must come after Start's vite plugin
    viteReact(),
    nitro(),
  ],
});
