import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
      },
      '/api/nasdaq': {
        target: 'https://api.nasdaq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nasdaq/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
          'Origin': 'https://www.nasdaq.com',
          'Referer': 'https://www.nasdaq.com/',
        },
      },
      '/api/sec': {
        target: 'https://data.sec.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sec/, ''),
        headers: { 'User-Agent': 'CorreaStockAnalysis contact@example.com' },
      },
      '/api/sec-files': {
        target: 'https://www.sec.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sec-files/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 CorreaStockAnalysis contact@example.com',
          'Accept': 'application/json,text/plain,*/*',
          'Accept-Encoding': 'identity',
        },
      },
    },
  },
})
