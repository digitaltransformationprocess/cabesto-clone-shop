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

// Charge le .env dans process.env SANS écraser les secrets injectés par la
// plateforme (Lovable). loadEnv priorise process.env, donc les secrets
// système restent intacts et le .env local ne sert qu'en complément.
const mode = process.env["NODE_ENV"] === "production" ? "production" : "development";
Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

const imagesRoot = path.resolve("data/images");

function serveMedia(
  req: { url?: string },
  res: { setHeader: (k: string, v: string) => void; pipe?: unknown } & NodeJS.WritableStream,
  next: () => void,
) {
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
}

function mediaPlugin() {
  return {
    name: "cabesto-media",
    configureServer(server: { middlewares: { use: (path: string, fn: typeof serveMedia) => void } }) {
      server.middlewares.use("/media", serveMedia);
    },
    configurePreviewServer(server: { middlewares: { use: (path: string, fn: typeof serveMedia) => void } }) {
      server.middlewares.use("/media", serveMedia);
    },
  };
}

export default defineLovableConfig({
  vite: {
    plugins: [mediaPlugin()],
    server: {
      fs: { allow: [path.resolve("."), path.resolve("data")] },
      // data/ holds ~7k scraped images/JSON — watching them freezes Vite SSR
      // (transport invoke timed out on virtual:tanstack-start-server-entry).
      watch: {
        ignored: ["**/data/**", "**/src/lib/catalog.json"],
      },
    },
    json: {
      stringify: true,
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
