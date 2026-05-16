const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;

// Extract video metadata using ffmpeg
async function extractVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(err);
      }

      // Extract relevant information
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const format = metadata.format;

      const result = {
        duration: format.duration || null,
        size: format.size || null,
        bitrate: format.bit_rate || null,
        format: format.format_name || null,
        codec: videoStream ? videoStream.codec_name : null,
        width: videoStream ? videoStream.width : null,
        height: videoStream ? videoStream.height : null,
        frameRate: videoStream ? eval(videoStream.r_frame_rate) : null,
        aspectRatio: videoStream ? videoStream.display_aspect_ratio : null
      };

      resolve(result);
    });
  });
}

// Get video duration quickly
async function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(err);
      }

      resolve(metadata.format.duration || 0);
    });
  });
}

// Extract metadata and update database
async function extractAndCacheMetadata(db, videoPath, relativePath) {
  try {
    const metadata = await extractVideoMetadata(videoPath);
    const stats = await fs.stat(videoPath);

    // Import database service
    const { upsertVideoMetadata } = require('./database');

    // Store in database
    upsertVideoMetadata(db, {
      relativePath,
      absolutePath: videoPath,
      fileSize: stats.size,
      modifiedTime: Math.floor(stats.mtimeMs / 1000),
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      codec: metadata.codec,
      bitrate: metadata.bitrate,
      hasThumbnail: false,
      thumbnailPath: null
    });

    return metadata;
  } catch (error) {
    throw new Error(`Failed to extract metadata: ${error.message}`);
  }
}

module.exports = {
  extractVideoMetadata,
  getVideoDuration,
  extractAndCacheMetadata
};
