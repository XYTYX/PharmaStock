import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: '0.0.0.0'
  },
  preview: {
    port: 3001,
    host: '0.0.0.0'
  },
  // Allow new-sight.local in production
  ...(process.env.NODE_ENV === 'production' && {
    server: {
      port: 3001,
      host: '0.0.0.0',
      allowedHosts: ['new-sight.local']
    },
    preview: {
      port: 3001,
      host: '0.0.0.0',
      allowedHosts: ['new-sight.local']
    }
  })
})
