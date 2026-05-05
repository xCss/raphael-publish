import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const enableDevServiceWorker = process.env.VITE_PWA_DEV === 'true'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'prompt',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
                name: 'Raphael Publish - 公众号排版大师',
                short_name: 'Raphael Publish',
                description: '专为微信公众号与内容创作者打造的现代 Markdown 排版引擎。',
                theme_color: '#fbfbfd',
                background_color: '#fbfbfd',
                display: 'standalone',
                start_url: '/',
                scope: '/',
                lang: 'zh-CN',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            },
            workbox: {
                cleanupOutdatedCaches: true,
                globPatterns: ['**/*.{js,css,html,svg,png,webp,ico}'],
                globIgnores: ['**/html2pdf-*.js'],
                navigateFallback: 'index.html'
            },
            devOptions: {
                enabled: enableDevServiceWorker
            }
        })
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined;
                    if (id.includes('html2pdf.js') || id.includes('html2canvas') || id.includes('jspdf')) return 'html2pdf';
                    if (id.includes('markdown-it') || id.includes('highlight.js')) return 'markdown';
                    if (id.includes('turndown')) return 'paste';
                    if (id.includes('framer-motion') || id.includes('lucide-react')) return 'ui-vendor';
                    if (id.includes('react') || id.includes('react-dom')) return 'react';
                    return 'vendor';
                }
            }
        }
    },
    base: '/',
})
