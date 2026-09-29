import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";

const host = process.env.TAURI_DEV_HOST;

/** Serve verified Windows release files from repo artifacts/windows at /downloads/windows/* */
function windowsDownloadsPlugin(): Plugin {
  const root = path.resolve(__dirname, "../../artifacts/windows");
  const ALLOWED = new Set([
    "release.json",
    "PVG-AI-Setup-x64.exe",
    "PVG-AI-Setup-x64.exe.sha256",
  ]);

  function serve(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = req.url?.split("?")[0] ?? "";
    if (!url.startsWith("/downloads/windows/")) return next();
    const name = decodeURIComponent(url.slice("/downloads/windows/".length));
    if (!ALLOWED.has(name) || name.includes("..") || name.includes("/") || name.includes("\\")) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const filePath = path.join(root, name);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const data = fs.readFileSync(filePath);
    res.setHeader("Cache-Control", "no-store");
    if (name.endsWith(".json")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    } else if (name.endsWith(".exe")) {
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    } else {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    res.end(data);
  }

  return {
    name: "pvg-windows-downloads",
    configureServer(server) {
      server.middlewares.use(serve);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve);
    },
  };
}

export default defineConfig({
  plugins: [react(), windowsDownloadsPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
