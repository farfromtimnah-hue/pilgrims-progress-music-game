import { defineConfig } from "vite";

// Serves /data (repo-root content JSON) alongside the app so the existing
// loaders.ts (fetch-based, path "/data/...") works unchanged in dev and build.
export default defineConfig({
  publicDir: "data-public",
  server: { fs: { allow: [".."] } },
});
