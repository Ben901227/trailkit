import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// Relative base so the same build works at the domain root and under a
// GitHub Pages project subpath (/<repo>/) without rebuilding.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'trailkit',
        short_name: 'trailkit',
        description: '檢視、編輯、合併 GPX / KML 軌跡並疊加圖層',
        lang: 'zh-Hant',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f6f7f9',
        theme_color: '#1f2933',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the app shell only. Map tiles are large, unbounded and
        // change per viewport; caching them would fill the user's storage.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,pbf}'],
        navigateFallback: 'index.html',
        runtimeCaching: [],
      },
    }),
  ],
  test: { environment: 'node' },
})
