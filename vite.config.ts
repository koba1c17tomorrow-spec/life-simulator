import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const base = "/life-simulator/";

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      manifest: {
        id: base,
        name: "人生の記録 — Life Simulator",
        short_name: "人生の記録",
        description: "出生から老後まで、月単位で進む人生シミュレーション",
        lang: "ja",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#f4f5f7",
        theme_color: "#345e80",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,json,svg,png,webmanifest}"],
        cleanupOutdatedCaches: true,
        // A new worker waits for a deliberate save-and-update action.
        skipWaiting: false,
        clientsClaim: true,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/\/worlds\//, /\/icons\//],
      },
    }),
  ],
});
