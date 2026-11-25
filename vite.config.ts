import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_API_BASE = 'http://localhost:7071/api';

const ensureApiBaseUrl = (raw?: string) => {
  if (!raw) return DEFAULT_API_BASE;
  const trimmed = raw.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = ensureApiBaseUrl(env.VITE_API_BASE_URL);

  return {
    plugins: [react()],
    // Fixed port: this app's port per the local port map (storefront 5173, admin 5174, superadmin 5175)
    // and rs-backend's Host.CORS allow-list. Fail instead of drifting to another port.
    server: { port: 5173, strictPort: true },
    define: {
      'process.env': {
        API_BASE_URL: apiBaseUrl,
      },
    },
  };
});
