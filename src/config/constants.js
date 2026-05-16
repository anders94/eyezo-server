// System file patterns to exclude from directory listings
const SYSTEM_FILE_PATTERNS = [
  /^\./,                    // Hidden files (.DS_Store, .git, etc.)
  /^Thumbs\.db$/i,          // Windows thumbnails
  /^desktop\.ini$/i,        // Windows folder config
  /^\$RECYCLE\.BIN$/i,      // Windows recycle bin
  /^node_modules$/,         // Node dependencies
  /^\.Spotlight-V100$/,     // macOS Spotlight
  /^\.TemporaryItems$/,     // macOS temporary
  /^\.Trashes$/,            // macOS trash
  /^\.fseventsd$/,          // macOS filesystem events
  /^\.VolumeIcon\.icns$/,   // macOS volume icon
  /^@eaDir$/,               // Synology metadata
  /^#recycle$/,             // Synology recycle bin
  /^\.AppleDouble$/,        // macOS resource forks
  /^\.DocumentRevisions-V100$/, // macOS document versions
  /^lost\+found$/           // Linux recovery directory
];

// Video file extensions and their MIME types
const VIDEO_MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.m2v': 'video/mpeg',
  '.3gp': 'video/3gpp',
  '.3g2': 'video/3gpp2',
  '.mts': 'video/mp2t',
  '.ts': 'video/mp2t',
  '.vob': 'video/dvd',
  '.ogv': 'video/ogg',
  '.m2ts': 'video/mp2t'
};

const VIDEO_EXTENSIONS = Object.keys(VIDEO_MIME_TYPES);

// Default server port
const DEFAULT_PORT = 3000;

// Default server host
const DEFAULT_HOST = '0.0.0.0';

// Thumbnail settings
const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 180;
const THUMBNAIL_QUALITY = 85;
const THUMBNAIL_TIMESTAMP_PERCENT = 0.01; // 1% into video

// Check if a filename should be filtered out (system file)
function isSystemFile(filename) {
  return SYSTEM_FILE_PATTERNS.some(pattern => pattern.test(filename));
}

// Check if a file is a video based on extension
function isVideoFile(filename) {
  const ext = filename.toLowerCase().match(/\.[^.]+$/);
  if (!ext) return false;
  return VIDEO_EXTENSIONS.includes(ext[0]);
}

module.exports = {
  SYSTEM_FILE_PATTERNS,
  VIDEO_MIME_TYPES,
  VIDEO_EXTENSIONS,
  DEFAULT_PORT,
  DEFAULT_HOST,
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_QUALITY,
  THUMBNAIL_TIMESTAMP_PERCENT,
  isSystemFile,
  isVideoFile
};
