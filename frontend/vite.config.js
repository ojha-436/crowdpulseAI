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
    rollupOptions: {
      output: {
        // Split heavy third-party libraries into separate, long-cacheable
        // vendor chunks so the main app bundle stays small and the charting /
        // Firebase code only downloads (and re-downloads on redeploy) on its own.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts") || id.includes("/d3-")) return "charts";
          if (id.includes("firebase") || id.includes("@firebase")) return "firebase";
          if (id.includes("/react") || id.includes("/scheduler")) return "react-vendor";
          return "vendor";
        },
      },
    },
  },
});
