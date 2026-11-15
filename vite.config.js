import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// host/port: Lovable's preview runs the dev server on port 8080 on all interfaces.
export default defineConfig({
  server: { host: '::', port: 8080 },
  plugins: [react()],
});
