const fs = require('fs');
const path = require('path');
const { getConfig } = require('../services/database');
const { DB_PATH } = require('../config/database');

// Web UI served to browsers at the root URL. Read once at startup.
const indexHtml = fs.readFileSync(
  path.join(__dirname, '..', '..', 'public', 'index.html'),
  'utf8'
);

async function routes(fastify, options) {
  // Health check endpoint
  fastify.get('/api/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime()
    };
  });

  // Server configuration endpoint
  fastify.get('/api/config', async (request, reply) => {
    const videoRoot = fastify.videoRoot;
    const db = fastify.db;

    const config = {
      videoRoot,
      databasePath: DB_PATH,
      serverVersion: getConfig(db, 'server_version'),
      lastFullScan: getConfig(db, 'last_full_scan')
    };

    return config;
  });

  // Root: serve the web UI to browsers, JSON descriptor to API clients.
  fastify.get('/', async (request, reply) => {
    const accept = request.headers.accept || '';
    if (accept.includes('text/html')) {
      return reply.type('text/html').send(indexHtml);
    }
    return {
      message: 'Eyezo Server API',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        config: '/api/config',
        browse: '/api/browse',
        video: '/api/video/*',
        thumbnail: '/api/thumbnail/*',
        metadata: '/api/metadata/*',
        scan: 'POST /api/scan'
      },
      documentation: 'https://github.com/anders94/eyezo-server'
    };
  });
}

module.exports = routes;
