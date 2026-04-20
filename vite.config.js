import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import convertHandler from './api/convert.js'

const createVercelStyleResponse = (res) => {
  res.status = (statusCode) => {
    res.statusCode = statusCode
    return res
  }

  res.json = (payload) => {
    if (!res.headersSent) {
      res.setHeader('content-type', 'application/json; charset=utf-8')
    }
    res.end(JSON.stringify(payload))
    return res
  }

  return res
}

const localApiPlugin = () => ({
  name: 'local-api-routes',
  configureServer(server) {
    server.middlewares.use('/api/convert', (req, res, next) => {
      const adaptedResponse = createVercelStyleResponse(res)
      Promise.resolve(convertHandler(req, adaptedResponse)).catch(next)
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    localApiPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logoreal.png', 'logo_192.png', 'logo_512.png'],
      manifest: {
        name: 'IntoDay',
        short_name: 'IntoDay',
        description: 'Organize your day with ease',
        theme_color: '#FFFFFF',
        background_color: '#F9F9F9',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'desktop_logo_192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'desktop_logo_512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'logo_192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'logo_512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    host: true  // allows LAN access for testing on phone
  },
  base: './',
})
