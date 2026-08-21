import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { IncomingMessage, ServerResponse } from 'http';

function serverAuthPlugin() {
  return {
    name: 'server-auth-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/auth/login', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer | string) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const { username, password } = JSON.parse(body || '{}');
              const trimmedUser = typeof username === 'string' ? username.trim() : '';

              if (trimmedUser === 'SILENT-81455Y' && password === '987566') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    success: true,
                    user: { username: trimmedUser, tier: 'VIP CLIENT' },
                  })
                );
              } else {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Invalid username or password',
                  })
                );
              }
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: false,
                  error: 'Invalid username or password',
                })
              );
            }
          });
        } else {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), serverAuthPlugin()],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});

