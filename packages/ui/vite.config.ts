import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 3001,
  },
  plugins: [
    tanstackStart({
      srcDirectory: 'app',
    }),
    react(),
  ],
})
