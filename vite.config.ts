import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const base = "/okkhor/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Okkhor",
        short_name: "Okkhor",
        description: "A private, offline Bangla writing studio.",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#f7f7f0",
        theme_color: "#f7f7f0",
        icons: [
          { src: `${base}images/icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${base}images/icon-512.png`, sizes: "512x512", type: "image/png" },
          {
            src: `${base}images/icon-maskable-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,webmanifest}"],
        globIgnores: ["**/avro*.js", "**/lexicon/**"],
        navigateFallback: `${base}index.html`,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/okkhor\/assets\/avro.*\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "okkhor-engine",
              expiration: { maxEntries: 1 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
