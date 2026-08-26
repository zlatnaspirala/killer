import path from 'path';
import { defineConfig } from 'vite';
import { backendApiPlugin } from './api/backend-middleware.js';

export default defineConfig(() => {
  return {
    plugins: [
      backendApiPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
