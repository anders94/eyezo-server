const path = require('path');
const mime = require('mime-types');
const { VIDEO_MIME_TYPES, VIDEO_EXTENSIONS, isVideoFile } = require('../config/constants');

// Get MIME type for a file path
// Prioritizes our custom video MIME types, falls back to mime-types package
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  // Check our custom video MIME types first
  if (VIDEO_MIME_TYPES[ext]) {
    return VIDEO_MIME_TYPES[ext];
  }

  // Fall back to mime-types package
  const detected = mime.lookup(filePath);

  // Default to video/mp4 for unknown video files
  if (!detected && isVideoFile(filePath)) {
    return 'video/mp4';
  }

  return detected || 'application/octet-stream';
}

// Get file extension from MIME type
function getExtension(mimeType) {
  // Check our custom mappings first
  for (const [ext, type] of Object.entries(VIDEO_MIME_TYPES)) {
    if (type === mimeType) {
      return ext;
    }
  }

  // Fall back to mime-types package
  return mime.extension(mimeType) || '';
}

// Check if MIME type is a video type
function isVideoMimeType(mimeType) {
  return mimeType && mimeType.startsWith('video/');
}

module.exports = {
  getMimeType,
  getExtension,
  isVideoMimeType,
  VIDEO_MIME_TYPES,
  VIDEO_EXTENSIONS,
  isVideoFile
};
