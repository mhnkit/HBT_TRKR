import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The 3D stage is lazy-loaded (React.lazy), so three / R3F / drei land in their own
// chunk and never block the first paint of the habit UI.
export default defineConfig({
  plugins: [react()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1400 },
})
