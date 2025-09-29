import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/pharmacy/',
  server: {
    port: 3001,
    host: '0.0.0.0',
    proxy: {
      '/pharmacy/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pharmacy/, '')
      }
    }
  },
  preview: {
    port: 3001,
    host: '0.0.0.0'
  }
})
