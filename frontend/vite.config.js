import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Keep the app entry small and split out only Firebase (which does NOT
    // depend on React). React and every library that calls into it at load time
    // (react-dom, recharts, lucide-react) MUST stay in one chunk — splitting
    // React into its own chunk breaks `React.forwardRef` interop at runtime.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("firebase") || id.includes("@firebase")) return "firebase";
          return "vendor";
        },
      },
    },
  },
});
