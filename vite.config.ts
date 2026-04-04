import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  define: {
    global: 'window',
  },
  server: {
    allowedHosts: ['ba45-185-178-236-109.ngrok-free.app'],
  },
});

