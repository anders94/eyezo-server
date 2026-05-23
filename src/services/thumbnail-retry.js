const { getDatabase } = require('../config/database');
const { generateAndCacheThumbnail, thumbnailExists } = require('./thumbnail');
const path = require('path');

/**
 * Find all videos that need thumbnail retry:
 * 1. Videos with thumbnail_failed = 1
 * 2. Videos marked as having thumbnails but missing on disk
 */
async function findVideosNeedingRetry(db) {
  // Find videos with explicit failures
  const failedVideos = db.prepare(`
    SELECT relative_path, absolute_path, thumbnail_error
    FROM videos
    WHERE thumbnail_failed = 1
  `).all();

  // Find videos with inconsistent state (db says has thumbnail but file missing)
  const allWithThumbnails = db.prepare(`
    SELECT relative_path, absolute_path, thumbnail_path
    FROM videos
    WHERE has_thumbnail = 1 AND thumbnail_failed = 0
  `).all();

  const inconsistentVideos = [];
  for (const video of allWithThumbnails) {
    const exists = await thumbnailExists(video.relative_path);
    if (!exists) {
      inconsistentVideos.push(video);
    }
  }

  return {
    failed: failedVideos,
    inconsistent: inconsistentVideos,
    total: failedVideos.length + inconsistentVideos.length
  };
}

/**
 * Reset thumbnail failure status for a video so it can be retried
 */
function resetThumbnailFailure(db, relativePath) {
  db.prepare(`
    UPDATE videos
    SET thumbnail_failed = 0,
        thumbnail_error = NULL,
        has_thumbnail = 0,
        thumbnail_path = NULL,
        updated_at = unixepoch()
    WHERE relative_path = ?
  `).run(relativePath);
}

/**
 * Retry generating thumbnails for failed videos
 */
async function retryFailedThumbnails(videoRoot, logger) {
  const startTime = Date.now();
  const db = getDatabase();

  logger.info('Starting thumbnail retry process...');

  try {
    // Find videos needing retry
    const { failed, inconsistent, total } = await findVideosNeedingRetry(db);

    if (total === 0) {
      logger.info('No thumbnails need retry');
      return {
        success: 0,
        failed: 0,
        total: 0,
        duration: 0
      };
    }

    logger.info(`Found ${total} videos needing thumbnail retry:`);
    logger.info(`  - ${failed.length} previously failed`);
    logger.info(`  - ${inconsistent.length} missing on disk`);

    const allVideos = [...failed, ...inconsistent];
    let successCount = 0;
    let failCount = 0;

    // Process each video
    for (let i = 0; i < allVideos.length; i++) {
      const video = allVideos[i];
      const progress = `[${i + 1}/${allVideos.length}]`;

      try {
        // Reset the failure status
        resetThumbnailFailure(db, video.relative_path);

        // Construct absolute path
        const absolutePath = path.isAbsolute(video.absolute_path)
          ? video.absolute_path
          : path.join(videoRoot, video.relative_path);

        // Retry thumbnail generation
        await generateAndCacheThumbnail(db, absolutePath, video.relative_path, logger);

        successCount++;
        logger.info(`${progress} ✓ Generated thumbnail for: ${video.relative_path}`);
      } catch (error) {
        failCount++;
        logger.warn(`${progress} ✗ Failed to generate thumbnail for: ${video.relative_path} - ${error.message}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info('');
    logger.info('Thumbnail retry complete:');
    logger.info(`  - ${successCount} succeeded`);
    logger.info(`  - ${failCount} failed`);
    logger.info(`  - Duration: ${duration}s`);

    return {
      success: successCount,
      failed: failCount,
      total: allVideos.length,
      duration: parseFloat(duration)
    };
  } catch (error) {
    logger.error(`Thumbnail retry process failed: ${error.message}`);
    throw error;
  }
}

/**
 * Start thumbnail retry process in background (non-blocking)
 */
function startThumbnailRetry(videoRoot, logger) {
  // Run in background without blocking
  setImmediate(async () => {
    try {
      await retryFailedThumbnails(videoRoot, logger);
    } catch (error) {
      logger.error(`Background thumbnail retry failed: ${error.message}`);
    }
  });
}

module.exports = {
  retryFailedThumbnails,
  startThumbnailRetry,
  findVideosNeedingRetry
};
