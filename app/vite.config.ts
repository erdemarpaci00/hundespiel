import { defineConfig } from 'vite'

// base './' macht die Seite unabhaengig vom Repo-Namen (GitHub Pages liegt unter /<repo>/).
// Phaser in eigener Datei: bleibt zwischen Updates gleich und kommt dann aus dem Browser-Cache.
export default defineConfig({
  base: './',
  server: { host: true },
  build: {
    chunkSizeWarningLimit: 1500,
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\/]phaser/ }] } } },
  },
})
