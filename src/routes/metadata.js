const fs = require('fs').promises;
const path = require('path');
const { validateAndResolvePath, fromUrlPath } = require('../utils/path-utils');
const { NotFoundError } = require('../utils/error-handler');
const { isVideoFile } = require('../utils/mime-types');
const { extractAndCacheMetadata } = require('../services/metadata');
const { generateAndCacheThumbnail } = require('../services/thumbnail');
const { getVideoMetadata, startScan, completeScan } = require('../services/database');
const { browseDirectory } = require('../services/filesystem');

async function routes(fastify, options) {
  // Get video metadata
  fastify.get('/api/metadata/*', async (request, reply) => {
    const videoRoot = fastify.videoRoot;
    const db = fastify.db;

    // Extract path from wildcard (after /api/metadata/)
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

    // Check if metadata exists in database
    let metadata = getVideoMetadata(db, relativePath);

    // If not cached, extract and cache it
    if (!metadata) {
      try {
        const extractedMetadata = await extractAndCacheMetadata(db, absolutePath, relativePath);
        metadata = getVideoMetadata(db, relativePath);
      } catch (error) {
        request.log.error({ err: error, video: relativePath }, 'Failed to extract metadata');
        throw new Error('Failed to extract video metadata');
      }
    }

    return {
      relativePath: metadata.relative_path,
      size: metadata.file_size,
      modified: metadata.modified_time,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      codec: metadata.codec,
      bitrate: metadata.bitrate,
      hasThumbnail: Boolean(metadata.has_thumbnail),
      lastScanned: metadata.last_scanned
    };
  });

  // Trigger metadata/thumbnail scan
  fastify.post('/api/scan', async (request, reply) => {
    const videoRoot = fastify.videoRoot;
    const db = fastify.db;
    const { path: scanPath } = request.body || {};

    // Resolve path to scan
    const relativePath = scanPath ? fromUrlPath(scanPath) : '';
    const { absolutePath } = validateAndResolvePath(videoRoot, relativePath);

    // Start scan history
    const scanType = scanPath ? 'partial' : 'full';
    const scanId = startScan(db, scanType, scanPath);

    let videosFound = 0;
    let thumbnailsGenerated = 0;

    try {
      // Recursively scan directory
      const results = await scanDirectory(videoRoot, absolutePath, relativePath, db);
      videosFound = results.videosFound;
      thumbnailsGenerated = results.thumbnailsGenerated;

      // Complete scan
      completeScan(db, scanId, videosFound, thumbnailsGenerated, 'completed');

      return {
        success: true,
        scanType,
        path: relativePath || '/',
        videosFound,
        thumbnailsGenerated
      };
    } catch (error) {
      completeScan(db, scanId, videosFound, thumbnailsGenerated, 'failed');
      throw error;
    }
  });
}

// Recursively scan directory for videos
async function scanDirectory(videoRoot, absolutePath, relativePath, db) {
  let videosFound = 0;
  let thumbnailsGenerated = 0;

  const { directories, videos } = await browseDirectory(videoRoot, relativePath, 'name', 'asc', db);

  // Process videos in this directory
  for (const video of videos) {
    videosFound++;

    // Extract metadata if not already cached
    const metadata = getVideoMetadata(db, video.relativePath);
    if (!metadata) {
      try {
        await extractAndCacheMetadata(db, video.path, video.relativePath);
      } catch (error) {
        // Log but continue
        console.error(`Failed to extract metadata for ${video.relativePath}:`, error.message);
      }
    }

    // Generate thumbnail if not already generated
    try {
      await generateAndCacheThumbnail(db, video.path, video.relativePath, null);
      thumbnailsGenerated++;
    } catch (error) {
      // Log but continue
      console.error(`Failed to generate thumbnail for ${video.relativePath}:`, error.message);
    }
  }

  // Recursively scan subdirectories
  for (const dir of directories) {
    const results = await scanDirectory(videoRoot, dir.path, dir.relativePath, db);
    videosFound += results.videosFound;
    thumbnailsGenerated += results.thumbnailsGenerated;
  }

  return { videosFound, thumbnailsGenerated };
}

module.exports = routes;
