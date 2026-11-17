import { defineConfig } from 'vite'

// base './' macht die Seite unabhaengig vom Repo-Namen (GitHub Pages liegt unter /<repo>/).
export default defineConfig({ base: './', server: { host: true } })
