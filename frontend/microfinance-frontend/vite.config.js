// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs   from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key:  fs.readFileSync(path.resolve(__dirname, 'key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'cert.pem')),
    },
    proxy: {
      '/api': {
        target: 'https://localhost:5000',
        changeOrigin: true,
        secure: false,
        // rewrite Domain so cookies appear under localhost:5173
        cookieDomainRewrite: { '127.0.0.1': 'localhost', '': '' },
        // **here** strip the leading "/api" from cookie paths
        cookiePathRewrite: { '^/api': '' }
      }
    },
  },
});

