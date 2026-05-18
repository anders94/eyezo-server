# Eyezo Server

A lightweight, standards-driven Node.js video server that serves video files from a directory tree via REST API with HTTP range request support for streaming to iOS and web clients.

## Features

- **Read-only file serving**: Serves video files without modifying the directory tree
- **REST API**: Clean REST endpoints for browsing directories and streaming videos
- **HTTP Range Requests**: Full support for video seeking/scrubbing
- **Thumbnail Generation**: Automatic thumbnail extraction at 1% into each video
- **Metadata Extraction**: FFmpeg-based video metadata extraction (duration, resolution, codec)
- **SQLite Database**: Caches metadata and thumbnail information
- **CORS Enabled**: Works with web and iOS clients
- **System File Filtering**: Automatically excludes .DS_Store, Thumbs.db, hidden files, etc.
- **Directory-first**: Always reads directly from filesystem (no filename caching)

## Clients

- [eyezo-ios](https://github.com/anders94/eyezo-ios)
- [eyezo-tvos](https://github.com/anders94/eyezo-tvos)

## Prerequisites

- Node.js 16+
- FFmpeg installed on your system
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `apt install ffmpeg`
  - Windows: Download from https://ffmpeg.org/

## Installation

```bash
npm install
```

## Usage

### Starting the Server

```bash
node server.js /path/to/your/videos
```

The server will start on port 3000 by default. You can customize the port and host:

```bash
PORT=8080 HOST=localhost node server.js /path/to/your/videos
```

### Development Mode (Auto-reload)

```bash
npm run dev /path/to/your/videos
```

## API Endpoints

### Health & Configuration

```
GET  /api/health          - Health check
GET  /api/config          - Server configuration
```

### Directory Browsing

```
GET  /api/browse          - Browse root directory
GET  /api/browse/*        - Browse subdirectory

Query Parameters:
  - sort: name|date|size (default: name)
  - order: asc|desc (default: asc)

Example:
  GET /api/browse/movies/action?sort=name&order=asc
```

**Response:**
```json
{
  "path": "/movies/action",
  "parent": "/movies",
  "directories": [
    {
      "name": "2024",
      "path": "/full/path/movies/action/2024",
      "relativePath": "movies/action/2024",
      "urlPath": "movies/action/2024",
      "modified": 1715875200
    }
  ],
  "videos": [
    {
      "name": "movie.mp4",
      "path": "/full/path/movie.mp4",
      "relativePath": "movies/action/movie.mp4",
      "urlPath": "movies/action/movie.mp4",
      "size": 1073741824,
      "modified": 1715875200,
      "extension": ".mp4",
      "mimeType": "video/mp4",
      "duration": 7200.5,
      "thumbnailUrl": "/api/thumbnail/movies/action/movie.mp4"
    }
  ],
  "totalDirectories": 1,
  "totalVideos": 1
}
```

### Video Streaming

```
GET  /api/video/*         - Stream video file with range request support

Headers:
  Range: bytes=start-end  (optional, for seeking)

Example:
  GET /api/video/movies/action/movie.mp4
  GET /api/video/movies/action/movie.mp4
  Headers: Range: bytes=0-1023
```

The server returns:
- `200 OK` for full file streaming
- `206 Partial Content` for range requests
- Proper `Accept-Ranges`, `Content-Range`, and `Content-Type` headers

### Thumbnails

```
GET  /api/thumbnail/*     - Get video thumbnail (JPEG)

Example:
  GET /api/thumbnail/movies/action/movie.mp4
```

Thumbnails are:
- Generated lazily on first request
- Extracted at 1% into the video
- 320x180 resolution
- Cached in `~/.local/eyezo-server/thumbnails/`

### Metadata

```
GET  /api/metadata/*      - Get video metadata

Example:
  GET /api/metadata/movies/action/movie.mp4
```

**Response:**
```json
{
  "relativePath": "movies/action/movie.mp4",
  "size": 1073741824,
  "modified": 1715875200,
  "duration": 7200.5,
  "width": 1920,
  "height": 1080,
  "codec": "h264",
  "bitrate": 5000000,
  "hasThumbnail": true,
  "lastScanned": 1715875300
}
```

### Scanning

```
POST /api/scan            - Trigger metadata/thumbnail generation

Body:
  { "path": "movies/action" }  // Optional, scans all if omitted
```

This endpoint:
- Recursively scans the specified directory (or all videos if no path)
- Extracts metadata for all videos
- Generates thumbnails for all videos
- Updates the database

## Data Storage

### Database
SQLite database stored at: `~/.local/eyezo-server/database.sqlite`

Contains:
- Video metadata (duration, resolution, codec, bitrate)
- Thumbnail status
- Configuration
- Scan history

### Thumbnails
Thumbnail cache stored at: `~/.local/eyezo-server/thumbnails/`

Filenames are MD5 hashes of the video's relative path.

## Supported Video Formats

- MP4 (.mp4, .m4v)
- MKV (.mkv)
- WebM (.webm)
- QuickTime (.mov)
- AVI (.avi)
- WMV (.wmv)
- FLV (.flv)
- MPEG (.mpg, .mpeg, .m2v)
- 3GP (.3gp, .3g2)
- MPEG-TS (.mts, .ts, .m2ts)
- VOB (.vob)
- OGG Video (.ogv)

## Client Usage Examples

### Web Browser (HTML)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Video Player</title>
</head>
<body>
  <video controls width="800">
    <source src="http://localhost:3000/api/video/movies/action/movie.mp4" type="video/mp4">
  </video>

  <img src="http://localhost:3000/api/thumbnail/movies/action/movie.mp4" alt="Thumbnail">
</body>
</html>
```

### JavaScript (Fetch API)

```javascript
// Browse directory
const response = await fetch('http://localhost:3000/api/browse/movies');
const data = await response.json();

console.log('Videos:', data.videos);
console.log('Subdirectories:', data.directories);

// Get metadata
const metadata = await fetch('http://localhost:3000/api/metadata/movies/movie.mp4');
const videoInfo = await metadata.json();

console.log('Duration:', videoInfo.duration);
console.log('Resolution:', `${videoInfo.width}x${videoInfo.height}`);
```

### iOS (Swift)

```swift
import AVKit

let url = URL(string: "http://localhost:3000/api/video/movies/movie.mp4")!
let player = AVPlayer(url: url)
let playerViewController = AVPlayerViewController()
playerViewController.player = player

present(playerViewController, animated: true) {
    player.play()
}
```

## Testing

### Manual Testing with cURL

```bash
# Health check
curl http://localhost:3000/api/health

# Browse root
curl http://localhost:3000/api/browse

# Browse subdirectory
curl http://localhost:3000/api/browse/movies/action

# Stream video (full)
curl http://localhost:3000/api/video/movie.mp4 -o test.mp4

# Stream video (range request)
curl -H "Range: bytes=0-1023" http://localhost:3000/api/video/movie.mp4

# Get thumbnail
curl http://localhost:3000/api/thumbnail/movie.mp4 -o thumb.jpg

# Get metadata
curl http://localhost:3000/api/metadata/movie.mp4

# Trigger scan
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"path": "movies"}'
```

## Security Considerations

### Path Traversal Protection

The server validates all paths to prevent directory traversal attacks. Requests like:

```
GET /api/video/../../etc/passwd
```

Will be rejected with a `403 Forbidden` error.

### No Authentication

This server does not include authentication. It's designed for use on trusted networks (home/local network). If you need to expose it to the internet, consider:

- Running it behind a reverse proxy (nginx, Apache) with authentication
- Using a VPN
- Implementing IP-based access control

## Performance

- **Streaming**: Uses Node.js streams for efficient memory usage with large files
- **Database**: Synchronous SQLite for fast metadata queries
- **Caching**: Thumbnails and metadata are cached to reduce FFmpeg overhead
- **CORS**: Preflight requests are cached for 24 hours

## Troubleshooting

### FFmpeg Not Found

If you get errors about FFmpeg:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Verify installation
ffmpeg -version
```

### Port Already in Use

Change the port:

```bash
PORT=8080 node server.js /path/to/videos
```

### Permission Denied

Ensure the video directory is readable:

```bash
ls -la /path/to/videos
```

### Database Locked

If you get database locked errors, ensure only one instance of the server is running.

## Project Structure

```
eyezo-server/
├── package.json
├── README.md
├── .gitignore
├── server.js                    # Entry point
├── src/
│   ├── app.js                   # Fastify app setup
│   ├── config/
│   │   ├── constants.js         # System file patterns, video extensions
│   │   └── database.js          # SQLite connection and schema
│   ├── routes/
│   │   ├── index.js             # Health check, config endpoints
│   │   ├── browse.js            # Directory browsing
│   │   ├── video.js             # Video streaming
│   │   ├── thumbnail.js         # Thumbnail serving
│   │   └── metadata.js          # Metadata and scanning
│   ├── services/
│   │   ├── filesystem.js        # Directory traversal, filtering
│   │   ├── video-stream.js      # Range request handling
│   │   ├── thumbnail.js         # Thumbnail generation
│   │   ├── metadata.js          # Metadata extraction
│   │   └── database.js          # Database queries
│   └── utils/
│       ├── mime-types.js        # MIME type detection
│       ├── path-utils.js        # Path validation
│       └── error-handler.js     # Error classes
└── scripts/
    └── init-db.js               # Database initialization
```

## License

MIT

## Contributing

Issues and pull requests are welcome!

## Acknowledgments

- Built with [Fastify](https://www.fastify.io/)
- Video processing with [FFmpeg](https://ffmpeg.org/)
- Database with [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
