import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Vercel/Vite environment variable handling for the SDK
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    server: {
      host: true
    },
    build: {
      chunkSizeWarningLimit: 1600, // Increased limit to suppress warnings
      rollupOptions: {
        output: {
          manualChunks: {
            // Split core vendor libraries
            vendor: ['react', 'react-dom', 'lucide-react', 'recharts', 'd3'],
            // Split GenAI SDK into its own chunk
            genai: ['@google/genai']
          }
        }
      }
    }
  }
})