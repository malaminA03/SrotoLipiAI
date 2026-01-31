import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env.API_KEY so it works in the browser
      // Using the provided key as a fallback if not found in .env
      'process.env.API_KEY': JSON.stringify(env.API_KEY || "AIzaSyAoW1O-45_dLJ3vI-9bhSjduAdHKD5SGJY")
    },
    server: {
      port: 3000,
      open: true
    }
  };
});