#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { createApp } = require('./src/app');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Error: No video directory specified');
  console.error('\nUsage: node server.js <video-directory-path>');
  console.error('Example: node server.js /Users/anders/Videos');
  console.error('\nDescription:');
  console.error('  Starts a lightweight video server that serves files from the specified directory.');
  console.error('  The directory tree is read-only and will not be modified.');
  process.exit(1);
}

const videoRoot = path.resolve(args[0]);

// Validate directory exists
if (!fs.existsSync(videoRoot)) {
  console.error(`Error: Directory does not exist: ${videoRoot}`);
  process.exit(1);
}

// Validate it's a directory
const stats = fs.statSync(videoRoot);
if (!stats.isDirectory()) {
  console.error(`Error: Path is not a directory: ${videoRoot}`);
  process.exit(1);
}

// Start server
console.log('Video Server Configuration:');
console.log(`  Video Directory: ${videoRoot}`);
console.log(`  Database: ~/.local/video-server/database.sqlite`);
console.log(`  Thumbnails: ~/.local/video-server/thumbnails/`);
console.log('');

async function start() {
  try {
    const app = await createApp(videoRoot);

    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    console.log(`Server listening on http://${host}:${port}`);
    console.log(`API base URL: http://${host}:${port}/api`);
    console.log('');
    console.log('Available endpoints:');
    console.log(`  GET    /api/health          - Health check`);
    console.log(`  GET    /api/config          - Server configuration`);
    console.log(`  GET    /api/browse          - Browse root directory`);
    console.log(`  GET    /api/browse/*        - Browse subdirectory`);
    console.log(`  GET    /api/video/*         - Stream video file`);
    console.log(`  GET    /api/thumbnail/*     - Get video thumbnail`);
    console.log(`  GET    /api/metadata/*      - Get video metadata`);
    console.log(`  POST   /api/scan            - Trigger metadata/thumbnail scan`);
    console.log(`  POST   /api/watch-progress  - Update watch position`);
    console.log(`  GET    /api/watch-progress/* - Get watch progress`);
    console.log(`  DELETE /api/watch-progress/* - Clear watch progress`);
    console.log('');
    console.log('Press Ctrl+C to stop the server');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down gracefully...');
  const { closeDatabase } = require('./src/config/database');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\nShutting down gracefully...');
  const { closeDatabase } = require('./src/config/database');
  closeDatabase();
  process.exit(0);
});
