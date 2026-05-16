const fastify = require('fastify');
const cors = require('@fastify/cors');
const { setupErrorHandler } = require('./utils/error-handler');
const { getDatabase } = require('./config/database');

async function createApp(videoRoot) {
  // Create Fastify instance with logger
  const app = fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          colorize: true
        }
      }
    },
    // Increase body size limit for future POST endpoints
    bodyLimit: 1048576 // 1MB
  });

  // Store video root in app instance for access in routes
  app.decorate('videoRoot', videoRoot);

  // Initialize database connection
  const db = getDatabase();
  app.decorate('db', db);

  // Update config with video root path
  db.prepare('UPDATE config SET value = ?, updated_at = unixepoch() WHERE key = ?')
    .run(videoRoot, 'video_root_path');

  // Register CORS plugin
  await app.register(cors, {
    origin: true,                // Allow all origins
    credentials: true,           // Allow credentials
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Range',                   // Critical for video streaming
      'Accept',
      'Origin'
    ],
    exposedHeaders: [
      'Content-Range',           // Required for range request responses
      'Accept-Ranges',
      'Content-Length',
      'Content-Type'
    ],
    maxAge: 86400                // Cache preflight for 24 hours
  });

  // Setup centralized error handler
  setupErrorHandler(app);

  // Register routes
  await app.register(require('./routes/index'));
  await app.register(require('./routes/browse'));
  await app.register(require('./routes/video'));
  await app.register(require('./routes/thumbnail'));
  await app.register(require('./routes/metadata'));

  return app;
}

module.exports = { createApp };
