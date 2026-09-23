import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works on GitHub project pages and locally.
  base: './',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
