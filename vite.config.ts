import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const authHeaders: Record<string, string> = {};
  if (env.FOOTBALL_DATA_TOKEN) authHeaders['X-Auth-Token'] = env.FOOTBALL_DATA_TOKEN;

  return {
    plugins: [
      react(),
      {
        name: 'local-api-5tv',
        configureServer(server) {
          server.middlewares.use('/api/5tv', async (req, res) => {
            try {
              // @ts-expect-error JS serverless endpoint
              const mod = await import('./api/5tv.js');
              await mod.default(req, res);
            } catch (e) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ streams: [], embeds: [], error: String(e) }));
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      proxy: {
        '/api/football-data': {
          target: 'https://api.football-data.org/v4',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/football-data/, ''),
          headers: authHeaders,
        },
      },
    },
    build: {
      target: 'esnext',
      cssMinify: true,
      minify: 'esbuild',
      chunkSizeWarningLimit: 1200,
    },
  };
});