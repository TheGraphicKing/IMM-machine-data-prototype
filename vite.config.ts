import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build` -> dist/ (code-split, 3D chunks lazy)
// `vite build --mode single` -> dist-single/index.html (everything inlined, works offline)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: [react(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    build: single
      ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 10_000, cssCodeSplit: false }
      : {
          outDir: 'dist',
          chunkSizeWarningLimit: 1200,
          rollupOptions: {
            output: {
              manualChunks: {
                three: ['three'],
                r3f: ['@react-three/fiber', '@react-three/drei'],
                post: ['@react-three/postprocessing', 'postprocessing'],
                motion: ['framer-motion'],
                react: ['react', 'react-dom', 'react-router-dom', 'zustand'],
              },
            },
          },
        },
  };
});
