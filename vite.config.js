import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import linkPreviewHandler from './api/link-preview.js'

const localLinkPreviewApi = () => ({
  name: 'local-link-preview-api',
  configureServer(server) {
    server.middlewares.use('/api/link-preview', async (req, res) => {
      const requestUrl = new URL(req.url || '/', 'http://localhost')
      const apiRequest = {
        query: {
          url: requestUrl.searchParams.get('url'),
        },
      }
      const apiResponse = {
        status(statusCode) {
          res.statusCode = statusCode
          return this
        },
        json(payload) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(payload))
          return this
        },
      }

      try {
        await linkPreviewHandler(apiRequest, apiResponse)
      } catch (error) {
        if (!res.writableEnded) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Failed to fetch link preview', details: error.message }))
        }
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    localLinkPreviewApi(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logoreal.png', 'logo_192.png', 'logo_512.png'],
      manifest: {
        name: 'IntoDay',
        short_name: 'IntoDay',
        description: 'Capture, organize, and connect research context over time',
        theme_color: '#FFFFFF',
        background_color: '#F9F9F9',
        display: 'standalone',
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
