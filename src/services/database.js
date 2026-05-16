// Database service for video metadata operations

// Get video metadata by relative path
function getVideoMetadata(db, relativePath) {
  return db.prepare(`
    SELECT *
    FROM videos
    WHERE relative_path = ?
  `).get(relativePath);
}

// Insert or update video metadata
function upsertVideoMetadata(db, data) {
  const {
    relativePath,
    absolutePath,
    fileSize,
    modifiedTime,
    duration,
    width,
    height,
    codec,
    bitrate,
    hasThumbnail,
    thumbnailPath
  } = data;

  return db.prepare(`
    INSERT INTO videos (
      relative_path, absolute_path, file_size, modified_time,
      duration, width, height, codec, bitrate,
      has_thumbnail, thumbnail_path, last_scanned, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(relative_path) DO UPDATE SET
      absolute_path = excluded.absolute_path,
      file_size = excluded.file_size,
      modified_time = excluded.modified_time,
      duration = excluded.duration,
      width = excluded.width,
      height = excluded.height,
      codec = excluded.codec,
      bitrate = excluded.bitrate,
      has_thumbnail = excluded.has_thumbnail,
      thumbnail_path = excluded.thumbnail_path,
      last_scanned = excluded.last_scanned,
      updated_at = excluded.updated_at
  `).run(
    relativePath,
    absolutePath,
    fileSize,
    modifiedTime,
    duration,
    width,
    height,
    codec,
    bitrate,
    hasThumbnail ? 1 : 0,
    thumbnailPath
  );
}

// Update thumbnail status for a video
function updateThumbnailStatus(db, relativePath, hasThumbnail, thumbnailPath) {
  return db.prepare(`
    UPDATE videos
    SET has_thumbnail = ?,
        thumbnail_path = ?,
        updated_at = unixepoch()
    WHERE relative_path = ?
  `).run(hasThumbnail ? 1 : 0, thumbnailPath, relativePath);
}

// Get all videos (for scanning)
function getAllVideos(db) {
  return db.prepare(`
    SELECT *
    FROM videos
    ORDER BY relative_path
  `).all();
}

// Delete video metadata by relative path
function deleteVideoMetadata(db, relativePath) {
  return db.prepare(`
    DELETE FROM videos
    WHERE relative_path = ?
  `).run(relativePath);
}

// Get config value
function getConfig(db, key) {
  const result = db.prepare(`
    SELECT value
    FROM config
    WHERE key = ?
  `).get(key);

  return result ? result.value : null;
}

// Set config value
function setConfig(db, key, value) {
  return db.prepare(`
    INSERT INTO config (key, value, updated_at)
    VALUES (?, ?, unixepoch())
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value);
}

// Start a scan history entry
function startScan(db, scanType, scanPath = null) {
  const result = db.prepare(`
    INSERT INTO scan_history (scan_type, path, started_at, status)
    VALUES (?, ?, unixepoch(), 'running')
  `).run(scanType, scanPath);

  return result.lastInsertRowid;
}

// Complete a scan history entry
function completeScan(db, scanId, videosFound, thumbnailsGenerated, status = 'completed') {
  const scan = db.prepare('SELECT started_at FROM scan_history WHERE id = ?').get(scanId);

  if (!scan) return;

  const duration = Date.now() / 1000 - scan.started_at;

  return db.prepare(`
    UPDATE scan_history
    SET videos_found = ?,
        thumbnails_generated = ?,
        duration_seconds = ?,
        completed_at = unixepoch(),
        status = ?
    WHERE id = ?
  `).run(videosFound, thumbnailsGenerated, duration, status, scanId);
}

// Get recent scan history
function getRecentScans(db, limit = 10) {
  return db.prepare(`
    SELECT *
    FROM scan_history
    ORDER BY started_at DESC
    LIMIT ?
  `).all(limit);
}

module.exports = {
  getVideoMetadata,
  upsertVideoMetadata,
  updateThumbnailStatus,
  getAllVideos,
  deleteVideoMetadata,
  getConfig,
  setConfig,
  startScan,
  completeScan,
  getRecentScans
};
