import { defineConfig } from 'vite';

// 使用相对路径，构建产物可以放在 GitHub Pages 的任意子路径下。
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
  },
});
