# Thumbnail Queue System

## Overview

The video server now includes an intelligent thumbnail generation system with:
- **Lazy generation**: Thumbnails are created only when requested
- **Failure tracking**: Bad/corrupted videos are recorded to avoid repeated attempts
- **Concurrent limiting**: Maximum 2 thumbnails generated at once
- **Request queuing**: Multiple requests for the same thumbnail wait for one generation

## How It Works

### 1. Lazy Generation (No Manual Scanning Required)

When a client requests a thumbnail via `GET /api/thumbnail/<path>`:

1. Server checks if thumbnail already exists on disk → return immediately
2. Server checks database for previous success → return cached path
3. Server checks database for previous failure → return error immediately
4. Server adds generation to queue (max 2 concurrent)
5. Client waits naturally until thumbnail is ready
6. Result is cached in database and disk

**You never need to call `POST /api/scan` anymore!**

### 2. Failure Tracking

If FFmpeg fails to generate a thumbnail (corrupted video, unsupported format, etc.):
- Failure is recorded in database with error message
- Future requests return error immediately without retrying
- Prevents wasting resources on bad files

Database columns added:
- `thumbnail_failed` (0 or 1)
- `thumbnail_error` (text description)

### 3. Concurrent Limiting

The `ThumbnailQueue` service limits concurrent FFmpeg operations:
- Default: **2 concurrent generations**
- Additional requests wait in queue
- No resource exhaustion from dozens of simultaneous FFmpeg processes

Queue status shown in logs:
```
Generating thumbnail for video.mp4 (queue: 2/3)
                                          ↑   ↑
                                     running  queued
```

### 4. Duplicate Request Handling

If 5 clients request the same thumbnail simultaneously:
- Only 1 FFmpeg process runs
- All 5 requests wait for the same promise
- All 5 receive the same generated thumbnail
- No redundant generation

## Examples

### Normal Usage (Lazy Load)

Client requests directory listing:
```bash
GET /api/browse/movies
```

Server returns videos with thumbnail URLs:
```json
{
  "videos": [
    {
      "name": "movie.mp4",
      "thumbnailUrl": "/api/thumbnail/movies/movie.mp4"
    }
  ]
}
```

Client loads thumbnails:
```html
<img src="/api/thumbnail/movies/movie.mp4" />
```

Server generates on first request, caches for future requests.

### Concurrent Requests

3 users browse a new directory simultaneously:
```
User 1 → GET /api/thumbnail/video1.mp4  ┐
User 2 → GET /api/thumbnail/video2.mp4  ├─ 2 generate concurrently
User 3 → GET /api/thumbnail/video3.mp4  ┘    1 waits in queue
```

Log output:
```
[17:02:41 UTC] INFO: Generating thumbnail for video1.mp4 (queue: 2/1)
[17:02:41 UTC] INFO: Generating thumbnail for video2.mp4 (queue: 2/1)
[17:02:42 UTC] INFO: GET /api/thumbnail/video1.mp4 → 200 (1200ms)
[17:02:42 UTC] INFO: Generating thumbnail for video3.mp4 (queue: 1/0)
[17:02:42 UTC] INFO: GET /api/thumbnail/video2.mp4 → 200 (1250ms)
[17:02:43 UTC] INFO: GET /api/thumbnail/video3.mp4 → 200 (850ms)
```

### Corrupted Video Handling

First request (generation fails):
```
[17:03:01 UTC] INFO: Generating thumbnail for corrupted.mp4 (queue: 1/0)
[17:03:02 UTC] ERROR: Thumbnail generation failed for corrupted.mp4: FFmpeg failed: Invalid data
[17:03:02 UTC] INFO: GET /api/thumbnail/corrupted.mp4 → 404 (1100ms)
```

Subsequent requests (failure cached):
```
[17:03:10 UTC] INFO: GET /api/thumbnail/corrupted.mp4 → 404 (2ms)
                                                               ↑
                                                          instant
```

## Database Schema

```sql
-- Existing columns:
has_thumbnail INTEGER DEFAULT 0
thumbnail_path TEXT

-- New columns:
thumbnail_failed INTEGER DEFAULT 0
thumbnail_error TEXT
```

Query to see failures:
```sql
SELECT relative_path, thumbnail_error
FROM videos
WHERE thumbnail_failed = 1;
```

## Configuration

Adjust concurrency in `src/services/thumbnail-queue.js`:

```javascript
const thumbnailQueue = new ThumbnailQueue(2); // Change to 1, 3, etc.
```

Lower values = less CPU usage, slower overall
Higher values = more CPU usage, faster overall

Recommended: 2-3 for desktop, 1-2 for limited resources

## Benefits

### For Clients
- Natural "lazy load" UX - thumbnails appear as they're generated
- No manual scan step required
- Fast response for cached thumbnails
- Predictable error handling for bad videos

### For Server
- Resource-friendly (limited concurrent FFmpeg processes)
- No repeated attempts on corrupted files
- No duplicate work for simultaneous requests
- Automatic caching in database

### For Users
- Just point clients at `/api/thumbnail/<path>`
- Everything else is automatic
- Works seamlessly with directory browsing
- No maintenance required
