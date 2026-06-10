import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";
import { resolve } from "path";

const includeEasterEgg = process.env.OCRMEOW_INCLUDE_EASTER_EGG === "1";
const input = {
  index: resolve(__dirname, "index.html"),
  offscreen: resolve(__dirname, "offscreen.html"),
  dashboard: resolve(__dirname, "dashboard.html"),
  sandbox: resolve(__dirname, "sandbox.html"),
  ...(includeEasterEgg ? { easter_egg: resolve(__dirname, "easter_egg_test.html") } : {}),
};

export default defineConfig({
  base: "./",
  plugins: [crx({ manifest })],
  build: {
    target: "esnext",
    minify: true,
    rollupOptions: {
      input,
    },
  },
  optimizeDeps: {
    exclude: ["@paddleocr/paddleocr-js"],
  },
});
