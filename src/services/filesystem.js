const fs = require('fs').promises;
const path = require('path');
const { isSystemFile, isVideoFile } = require('../config/constants');
const { NotFoundError } = require('../utils/error-handler');
const { toUrlPath } = require('../utils/path-utils');
const { getMimeType } = require('../utils/mime-types');

// Read directory and return structured data
async function readDirectory(absolutePath, relativePath, videoRoot, db) {
  // Check if directory exists
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isDirectory()) {
      throw new NotFoundError('Path is not a directory');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new NotFoundError('Directory not found');
    }
    throw error;
  }

  // Read directory contents
  const entries = await fs.readdir(absolutePath);

  // Filter out system files and process entries
  const directories = [];
  const videos = [];

  for (const entry of entries) {
    // Skip system files
    if (isSystemFile(entry)) {
      continue;
    }

    const entryPath = path.join(absolutePath, entry);
    const entryRelativePath = relativePath ? `${relativePath}/${entry}` : entry;

    try {
      const stats = await fs.stat(entryPath);

      if (stats.isDirectory()) {
        directories.push({
          name: entry,
          path: entryPath,
          relativePath: entryRelativePath,
          urlPath: toUrlPath(entryRelativePath),
          modified: Math.floor(stats.mtimeMs / 1000)
        });
      } else if (isVideoFile(entry)) {
        const videoInfo = {
          name: entry,
          path: entryPath,
          relativePath: entryRelativePath,
          urlPath: toUrlPath(entryRelativePath),
          size: stats.size,
          modified: Math.floor(stats.mtimeMs / 1000),
          extension: path.extname(entry).toLowerCase(),
          mimeType: getMimeType(entry),
          thumbnailUrl: `/api/thumbnail/${toUrlPath(entryRelativePath)}`
        };

        // Try to get cached metadata from database
        const metadata = db.prepare(`
          SELECT duration, width, height, codec, bitrate, has_thumbnail,
                 watch_position, last_watched
          FROM videos
          WHERE relative_path = ?
        `).get(entryRelativePath);

        if (metadata) {
          videoInfo.duration = metadata.duration;
          videoInfo.width = metadata.width;
          videoInfo.height = metadata.height;
          videoInfo.codec = metadata.codec;
          videoInfo.bitrate = metadata.bitrate;
          videoInfo.hasThumbnail = Boolean(metadata.has_thumbnail);

          // Add watch progress information
          videoInfo.watchPosition = metadata.watch_position || 0;
          videoInfo.lastWatched = metadata.last_watched || 0;
        }

        videos.push(videoInfo);
      }
    } catch (error) {
      // Skip entries that can't be accessed
      continue;
    }
  }

  return { directories, videos };
}

// Sort entries by specified field and order
function sortEntries(entries, sortBy = 'name', order = 'asc') {
  const sorted = [...entries];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        break;
      case 'date':
      case 'modified':
        comparison = a.modified - b.modified;
        break;
      case 'size':
        comparison = (a.size || 0) - (b.size || 0);
        break;
      default:
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    }

    return order === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

// Browse directory with sorting
async function browseDirectory(videoRoot, relativePath, sortBy, order, db) {
  const { directories, videos } = await readDirectory(
    path.join(videoRoot, relativePath),
    relativePath,
    videoRoot,
    db
  );

  // Sort directories and videos
  const sortedDirectories = sortEntries(directories, sortBy, order);
  const sortedVideos = sortEntries(videos, sortBy, order);

  return {
    directories: sortedDirectories,
    videos: sortedVideos
  };
}

module.exports = {
  readDirectory,
  sortEntries,
  browseDirectory
};
