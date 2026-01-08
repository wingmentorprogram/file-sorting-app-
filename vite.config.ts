import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Safely expose API_KEY
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Polyfill process.env to prevent "process is not defined" crashes
      'process.env': {} 
    },
    server: {
      host: true
    },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'lucide-react', 'recharts', 'd3'],
            genai: ['@google/genai']
          }
        }
      }
    }
  }
})