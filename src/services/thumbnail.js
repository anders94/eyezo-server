const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;
const os = require('os');
const {
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_QUALITY,
  THUMBNAIL_TIMESTAMP_PERCENT
} = require('../config/constants');
const { getVideoDuration } = require('./metadata');

// Thumbnail directory: ~/.local/video-server/thumbnails/
const THUMBNAIL_DIR = path.join(os.homedir(), '.local', 'video-server', 'thumbnails');

// Ensure thumbnail directory exists
async function ensureThumbnailDirectory() {
  try {
    await fs.mkdir(THUMBNAIL_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

// Generate thumbnail filename from relative path
function getThumbnailFilename(relativePath) {
  const hash = crypto.createHash('md5').update(relativePath).digest('hex');
  return `${hash}.jpg`;
}

// Get full thumbnail path
function getThumbnailPath(relativePath) {
  return path.join(THUMBNAIL_DIR, getThumbnailFilename(relativePath));
}

// Check if thumbnail exists
async function thumbnailExists(relativePath) {
  const thumbnailPath = getThumbnailPath(relativePath);
  try {
    await fs.access(thumbnailPath);
    return true;
  } catch {
    return false;
  }
}

// Generate thumbnail for a video
async function generateThumbnail(videoPath, relativePath) {
  await ensureThumbnailDirectory();

  const thumbnailPath = getThumbnailPath(relativePath);

  // Check if thumbnail already exists
  if (await thumbnailExists(relativePath)) {
    return thumbnailPath;
  }

  try {
    // Get video duration
    const duration = await getVideoDuration(videoPath);
    const timestamp = Math.max(1, duration * THUMBNAIL_TIMESTAMP_PERCENT);

    // Generate thumbnail
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: getThumbnailFilename(relativePath),
          folder: THUMBNAIL_DIR,
          size: `${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}`
        })
        .on('end', () => resolve(thumbnailPath))
        .on('error', (err) => reject(new Error(`Thumbnail generation failed: ${err.message}`)));
    });
  } catch (error) {
    throw new Error(`Failed to generate thumbnail: ${error.message}`);
  }
}

// Generate thumbnail and update database
async function generateAndCacheThumbnail(db, videoPath, relativePath) {
  try {
    const thumbnailPath = await generateThumbnail(videoPath, relativePath);

    // Update database
    const { updateThumbnailStatus } = require('./database');
    updateThumbnailStatus(db, relativePath, true, thumbnailPath);

    return thumbnailPath;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  generateThumbnail,
  generateAndCacheThumbnail,
  thumbnailExists,
  getThumbnailPath,
  THUMBNAIL_DIR
};
