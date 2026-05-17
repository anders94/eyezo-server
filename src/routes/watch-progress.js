const { validateAndResolvePath, fromUrlPath } = require('../utils/path-utils');
const { ValidationError } = require('../utils/error-handler');
const { updateWatchProgress, getWatchProgress, clearWatchProgress } = require('../services/database');

async function routes(fastify, options) {
  // Update watch progress
  fastify.post('/api/watch-progress', async (request, reply) => {
    const { path: urlPath, position } = request.body || {};
    const videoRoot = fastify.videoRoot;
    const db = fastify.db;

    // Validate input
    if (!urlPath) {
      throw new ValidationError('Missing required field: path');
    }

    if (typeof position !== 'number' || position < 0) {
      throw new ValidationError('Invalid position: must be a non-negative number');
    }

    // Decode and validate path
    const relativePath = fromUrlPath(urlPath);
    const { absolutePath } = validateAndResolvePath(videoRoot, relativePath);

    // Update watch progress in database
    updateWatchProgress(db, relativePath, absolutePath, position, 0);

    return {
      success: true,
      path: relativePath,
      position
    };
  });

  // Get watch progress for a specific video
  fastify.get('/api/watch-progress/*', async (request, reply) => {
    const videoRoot = fastify.videoRoot;
    const db = fastify.db;

    // Extract path from wildcard
    const urlPath = request.params['*'];
    const relativePath = fromUrlPath(urlPath);

    // Validate path
    validateAndResolvePath(videoRoot, relativePath);

    // Get watch progress from database
    const progress = getWatchProgress(db, relativePath);

    if (!progress || progress.watch_position === 0) {
      return {
        path: relativePath,
        position: 0,
        lastWatched: 0
      };
    }

    return {
      path: relativePath,
      position: progress.watch_position,
      lastWatched: progress.last_watched
    };
  });

  // Clear watch progress (mark as unwatched)
  fastify.delete('/api/watch-progress/*', async (request, reply) => {
    const videoRoot = fastify.videoRoot;
    const db = fastify.db;

    // Extract path from wildcard
    const urlPath = request.params['*'];
    const relativePath = fromUrlPath(urlPath);

    // Validate path
    validateAndResolvePath(videoRoot, relativePath);

    // Clear watch progress
    clearWatchProgress(db, relativePath);

    return {
      success: true,
      path: relativePath,
      message: 'Watch progress cleared'
    };
  });
}

module.exports = routes;
