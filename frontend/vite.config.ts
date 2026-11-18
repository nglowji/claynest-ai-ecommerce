import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: '..',
  server: { port: 5173, strictPort: true, proxy: { '/media': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: true }, '/api': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: true } } },
  preview: { proxy: { '/media': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: true }, '/api': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: true } } },
})
