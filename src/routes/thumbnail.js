const fs = require('fs');
const { validateAndResolvePath, fromUrlPath } = require('../utils/path-utils');
const { NotFoundError } = require('../utils/error-handler');
const { isVideoFile } = require('../utils/mime-types');
const { generateAndCacheThumbnail, getThumbnailPath } = require('../services/thumbnail');

async function routes(fastify, options) {
  // Get video thumbnail
  fastify.get('/api/thumbnail/*', async (request, reply) => {
    const videoRoot = fastify.videoRoot;
    const db = fastify.db;

    // Extract path from wildcard (after /api/thumbnail/)
    const urlPath = request.params['*'];
    const relativePath = fromUrlPath(urlPath);

    // Validate and resolve path
    const { absolutePath } = validateAndResolvePath(videoRoot, relativePath);

    // Check if file exists and is a video
    try {
      const stats = await fs.promises.stat(absolutePath);

      if (!stats.isFile()) {
        throw new NotFoundError('Not a file');
      }

      if (!isVideoFile(absolutePath)) {
        throw new NotFoundError('Not a video file');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundError('Video file not found');
      }
      throw error;
    }

    // Generate thumbnail if it doesn't exist (lazy generation with queue)
    let thumbnailPath;
    try {
      thumbnailPath = await generateAndCacheThumbnail(db, absolutePath, relativePath, request.log);
    } catch (error) {
      request.log.error(`Failed to generate thumbnail for ${relativePath}: ${error.message}`);
      throw new NotFoundError('Failed to generate thumbnail');
    }

    // Stream thumbnail
    const stream = fs.createReadStream(thumbnailPath);

    reply
      .code(200)
      .header('Content-Type', 'image/jpeg')
      .header('Cache-Control', 'public, max-age=86400') // Cache for 24 hours
      .send(stream);
  });
}

module.exports = routes;
