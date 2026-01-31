import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Polyfill process.env to avoid errors in libraries that expect it
    'process.env': {} 
  },
  server: {
    port: 3000,
    open: true
  }
});