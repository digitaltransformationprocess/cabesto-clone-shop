// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig as defineLovableConfig } from "@lovable.dev/vite-tanstack-config";

// Charge le .env dans process.env en FORÇANT l'écrasement (sinon un vieux
// AI_MODEL reste figé après un restart Vite soft — loadEnv priorise process.env).
const mode = process.env.NODE_ENV === "production" ? "production" : "development";
for (const key of ["AI_API_KEY", "AI_PROVIDER", "AI_MODEL"]) {
  delete process.env[key];
}
Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

const imagesRoot = path.resolve("data/images");

function mediaPlugin() {
  return {
    name: "cabesto-media",
    configureServer(server: { middlewares: { use: (path: string, fn: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use("/media", (req, res, next) => {
        try {
          const urlPath = decodeURIComponent(String(req.url || "/").split("?")[0] || "/");
          const file = path.normalize(path.join(imagesRoot, urlPath));
          if (!file.startsWith(imagesRoot)) return next();
          if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
          const ext = path.extname(file).toLowerCase();
          const types: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
          };
          res.setHeader("Content-Type", types[ext] || "application/octet-stream");
          res.setHeader("Cache-Control", "public, max-age=86400");
          fs.createReadStream(file).pipe(res);
        } catch {
          next();
        }
      });
    },
  };
}

export default defineLovableConfig({
  vite: {
    plugins: [mediaPlugin()],
    server: {
      fs: { allow: [path.resolve("."), path.resolve("data")] },
    },
    json: {
      stringify: true,
    },
  },
  nitro: {
    publicAssets: [{ baseURL: "media", dir: "data/images", maxAge: 60 * 60 * 24 }],
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
