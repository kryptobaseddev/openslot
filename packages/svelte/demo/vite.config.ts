import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  // GitHub Pages serves the demo under /openslot/
  base: process.env.BASE_PATH ?? '/',
  plugins: [svelte()],
  server: { port: 4318, strictPort: true },
  build: { outDir: new URL('../demo-dist', import.meta.url).pathname, emptyOutDir: true }
});
