import { cbBuildDefinesFromEnv } from '@contextbridge/context/build';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    tailwindcss(),
    viteSingleFile(),
  ],
  define: cbBuildDefinesFromEnv(),
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
});
