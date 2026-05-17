# Watch Progress Tracking

## Overview

The video server tracks watch progress for videos, allowing clients to:
- Report their current playback position
- Resume playback from where they left off
- Display progress indicators
- Mark videos as watched/unwatched

## Features

### Automatic Progress in Browse Listings

All video objects in browse responses include watch progress:

```json
{
  "name": "movie.mp4",
  "relativePath": "movies/movie.mp4",
  "duration": 3600,
  "watchPosition": 1800,
  "lastWatched": 1778985835
}
```

### Fields

- **duration**: Total video duration in seconds (from FFmpeg metadata, may be null if not extracted)
- **watchPosition**: Current playback position in seconds (0 if unwatched)
- **lastWatched**: Unix timestamp of last watch progress update (0 if never watched)

**Note:** Clients should calculate percentage watched as `(watchPosition / duration) * 100` when needed.

## API Endpoints

### Update Watch Progress

Report current playback position:

```bash
POST /api/watch-progress
Content-Type: application/json

{
  "path": "movies/action/movie.mp4",
  "position": 150.5
}
```

**Response:**
```json
{
  "success": true,
  "path": "movies/action/movie.mp4",
  "position": 150.5
}
```

**When to call:**
- Periodically during playback (every 10-30 seconds recommended)
- When user pauses
- When user seeks to a new position
- When playback ends

### Get Watch Progress

Retrieve watch progress for a specific video:

```bash
GET /api/watch-progress/movies/action/movie.mp4
```

**Response:**
```json
{
  "path": "movies/action/movie.mp4",
  "position": 150.5,
  "lastWatched": 1778985835
}
```

### Clear Watch Progress

Mark video as unwatched:

```bash
DELETE /api/watch-progress/movies/action/movie.mp4
```

**Response:**
```json
{
  "success": true,
  "path": "movies/action/movie.mp4",
  "message": "Watch progress cleared"
}
```

## Client Implementation Examples

### iOS (Swift)

```swift
// Report progress during playback
func reportWatchProgress(path: String, position: Double) {
    let url = URL(string: "http://server:3000/api/watch-progress")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body = [
        "path": path,
        "position": position
    ] as [String : Any]

    request.httpBody = try? JSONSerialization.data(withJSONObject: body)

    URLSession.shared.dataTask(with: request).resume()
}

// Resume playback from last position
func resumePlayback(video: Video, player: AVPlayer) {
    if let duration = video.duration, video.watchPosition > 0, video.watchPosition < duration {
        let time = CMTime(seconds: video.watchPosition, preferredTimescale: 1)
        player.seek(to: time)
    }
}

// Update progress periodically
func setupProgressTracking(player: AVPlayer, videoPath: String) {
    let interval = CMTime(seconds: 10, preferredTimescale: 1)
    player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { time in
        let position = time.seconds
        reportWatchProgress(path: videoPath, position: position)
    }
}

// Calculate percentage watched
func percentageWatched(video: Video) -> Double {
    guard let duration = video.duration, duration > 0 else { return 0 }
    return (video.watchPosition / duration) * 100
}
```

### Web (JavaScript)

```javascript
// Report progress during playback
function reportWatchProgress(path, position) {
  fetch('http://server:3000/api/watch-progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, position })
  });
}

// Resume playback from last position
function resumePlayback(video, videoElement) {
  if (video.duration && video.watchPosition > 0 && video.watchPosition < video.duration) {
    videoElement.currentTime = video.watchPosition;
  }
}

// Update progress periodically
const videoElement = document.querySelector('video');
const videoPath = 'movies/action/movie.mp4';

setInterval(() => {
  if (!videoElement.paused) {
    reportWatchProgress(videoPath, videoElement.currentTime);
  }
}, 10000); // Every 10 seconds

// Also report on pause and seeking
videoElement.addEventListener('pause', () => {
  reportWatchProgress(videoPath, videoElement.currentTime);
});

videoElement.addEventListener('seeked', () => {
  reportWatchProgress(videoPath, videoElement.currentTime);
});

// Calculate percentage watched
function percentageWatched(video) {
  if (!video.duration || video.duration <= 0) return 0;
  return (video.watchPosition / video.duration) * 100;
}
```

## Use Cases

### Resume Playback

When listing videos, check if `watchPosition > 0`:

```javascript
if (video.duration && video.watchPosition > 0 && video.watchPosition < video.duration) {
  // Show "Resume" button instead of "Play"
  const percent = (video.watchPosition / video.duration) * 100;
  // Display progress bar showing percent
  // When clicked, start playback at watchPosition
}
```

### Continue Watching Section

Sort videos by `lastWatched` descending:

```javascript
// Get recently watched videos
const recentlyWatched = videos
  .filter(v => {
    if (!v.duration || v.duration <= 0) return false;
    const percent = (v.watchPosition / v.duration) * 100;
    return v.watchPosition > 0 && percent < 95;
  })
  .sort((a, b) => b.lastWatched - a.lastWatched)
  .slice(0, 10);
```

### Mark as Watched

Consider video "watched" when >= 95% complete:

```javascript
function isWatched(video) {
  if (!video.duration || video.duration <= 0) return false;
  const percent = (video.watchPosition / video.duration) * 100;
  return percent >= 95;
}

if (isWatched(video)) {
  // Show "watched" indicator
  // Optionally clear progress to reset
}
```

### Watched Indicator UI

Show visual feedback based on watch progress:

```javascript
function getWatchStatus(video) {
  if (!video.duration || video.duration <= 0) {
    return 'unknown';  // No metadata yet
  }

  const percent = (video.watchPosition / video.duration) * 100;

  if (percent >= 95) {
    return 'watched';  // Green checkmark
  } else if (percent > 5) {
    return 'in-progress';  // Progress bar
  } else {
    return 'unwatched';  // Default state
  }
}
```

## Database Storage

Watch progress is stored in the `videos` table:

```sql
-- Schema
watch_position REAL DEFAULT 0      -- Current position in seconds
watch_duration REAL DEFAULT 0      -- Stored for internal use
last_watched INTEGER DEFAULT 0     -- Unix timestamp
duration REAL                      -- From FFmpeg metadata

-- Query recently watched
SELECT * FROM videos
WHERE watch_position > 0
ORDER BY last_watched DESC
LIMIT 10;

-- Query partially watched (not finished)
SELECT * FROM videos
WHERE watch_position > 0
  AND duration > 0
  AND (watch_position / duration) < 0.95
ORDER BY last_watched DESC;
```

## Best Practices

### Update Frequency

- **During playback**: Every 10-30 seconds (balance between accuracy and server load)
- **On pause**: Immediately
- **On seek**: Immediately after seeking completes
- **On end**: When video finishes or user navigates away

### Handling Multiple Devices

The server stores a single watch position per video:
- Last device to report wins
- Use `lastWatched` timestamp to show "Last watched on Device X"
- Consider showing timestamp: "Watched 2 hours ago"

### Network Reliability

Make progress updates non-blocking:
- Fire and forget (don't wait for response)
- Queue failed updates for retry
- Don't block UI on progress update failures

### Privacy Considerations

Watch progress is stored per video file, not per user:
- All clients share the same progress
- Suitable for single-user or family scenarios
- Not suitable for multi-tenant environments without modification

## Performance

- Progress updates are lightweight (< 1ms database writes)
- No impact on video streaming
- Browse endpoints include progress with no additional overhead
- SQLite indexes ensure fast lookups

## Future Enhancements

Potential additions (not currently implemented):
- Per-user watch progress
- Watch history timeline
- Statistics (total watch time, most watched, etc.)
- Recommendations based on watch patterns
