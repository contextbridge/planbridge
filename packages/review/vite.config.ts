import { cbBuildDefinesFromEnv } from '@contextbridge/context/build';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss(), viteSingleFile()],
  define: cbBuildDefinesFromEnv(),
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
  },
});
