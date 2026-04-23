import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";
import { resolve } from "path";

export default defineConfig({
  base: "./",
  plugins: [crx({ manifest })],
  build: {
    target: "esnext",
    minify: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        offscreen: resolve(__dirname, "offscreen.html"),
        dashboard: resolve(__dirname, "dashboard.html"),
        sandbox: resolve(__dirname, "sandbox.html"),
        easter_egg: resolve(__dirname, "easter_egg_test.html"),
      },
    },
  },
  optimizeDeps: {
    exclude: ["@paddleocr/paddleocr-js"],
  },
});
