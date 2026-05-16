const { validateAndResolvePath, getParentPath, fromUrlPath } = require('../utils/path-utils');
const { browseDirectory } = require('../services/filesystem');

async function routes(fastify, options) {
  // Browse root directory
  fastify.get('/api/browse', async (request, reply) => {
    const { sort = 'name', order = 'asc' } = request.query;
    const videoRoot = fastify.videoRoot;
    const db = fastify.db;

    const { directories, videos } = await browseDirectory(videoRoot, '', sort, order, db);

    return {
      path: '/',
      parent: null,
      directories,
      videos,
      totalDirectories: directories.length,
      totalVideos: videos.length
    };
  });

  // Browse subdirectory
  fastify.get('/api/browse/*', async (request, reply) => {
    const { sort = 'name', order = 'asc' } = request.query;
    const videoRoot = fastify.videoRoot;
    const db = fastify.db;

    // Extract path from wildcard (after /api/browse/)
    const urlPath = request.params['*'];
    const relativePath = fromUrlPath(urlPath);

    // Validate and resolve path
    const { absolutePath } = validateAndResolvePath(videoRoot, relativePath);

    // Browse the directory
    const { directories, videos } = await browseDirectory(videoRoot, relativePath, sort, order, db);

    // Get parent path
    const parent = getParentPath(relativePath);

    return {
      path: `/${relativePath}`,
      parent: parent !== null ? `/${parent}` : null,
      directories,
      videos,
      totalDirectories: directories.length,
      totalVideos: videos.length
    };
  });
}

module.exports = routes;
