const fs = require('fs');
const { getMimeType } = require('../utils/mime-types');
const { RangeNotSatisfiableError } = require('../utils/error-handler');

// Stream video file with range request support
async function streamVideo(reply, filePath, rangeHeader) {
  const stats = await fs.promises.stat(filePath);
  const fileSize = stats.size;
  const mimeType = getMimeType(filePath);

  // Parse range header if present
  if (rangeHeader) {
    // Parse Range: bytes=start-end
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    // Validate range
    if (start >= fileSize || end >= fileSize || start > end) {
      throw new RangeNotSatisfiableError(`Invalid range: ${start}-${end}/${fileSize}`);
    }

    const chunkSize = (end - start) + 1;

    // Create read stream for partial content
    const stream = fs.createReadStream(filePath, { start, end });

    reply
      .code(206)
      .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      .header('Accept-Ranges', 'bytes')
      .header('Content-Length', chunkSize)
      .header('Content-Type', mimeType)
      .header('Cache-Control', 'public, max-age=3600')
      .send(stream);

  } else {
    // Full file stream (no range request)
    const stream = fs.createReadStream(filePath);

    reply
      .code(200)
      .header('Accept-Ranges', 'bytes')
      .header('Content-Length', fileSize)
      .header('Content-Type', mimeType)
      .header('Cache-Control', 'public, max-age=3600')
      .send(stream);
  }
}

module.exports = {
  streamVideo
};
