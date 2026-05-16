const fs = require('fs').promises;
const { validateAndResolvePath, fromUrlPath } = require('../utils/path-utils');
const { NotFoundError } = require('../utils/error-handler');
const { isVideoFile } = require('../utils/mime-types');
const { streamVideo } = require('../services/video-stream');

async function routes(fastify, options) {
  // Stream video file
  fastify.get('/api/video/*', async (request, reply) => {
    const videoRoot = fastify.videoRoot;

    // Extract path from wildcard (after /api/video/)
    const urlPath = request.params['*'];
    const relativePath = fromUrlPath(urlPath);

    // Validate and resolve path
    const { absolutePath } = validateAndResolvePath(videoRoot, relativePath);

    // Check if file exists and is a video
    try {
      const stats = await fs.stat(absolutePath);

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

    // Get Range header
    const rangeHeader = request.headers.range;

    // Stream the video
    await streamVideo(reply, absolutePath, rangeHeader);
  });
}

module.exports = routes;
