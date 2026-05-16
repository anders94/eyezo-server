const path = require('path');
const { PathTraversalError } = require('./error-handler');

// Normalize path separators and remove trailing slashes
function normalizePath(inputPath) {
  if (!inputPath) return '';

  // Convert backslashes to forward slashes
  let normalized = inputPath.replace(/\\/g, '/');

  // Remove trailing slashes (but keep single '/')
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, '');
  }

  // Remove leading slashes for relative paths
  normalized = normalized.replace(/^\/+/, '');

  return normalized;
}

// Validate and resolve a path relative to video root
// Throws PathTraversalError if path tries to escape video root
function validateAndResolvePath(videoRoot, relativePath) {
  // Normalize the relative path
  const normalized = normalizePath(relativePath || '');

  // Resolve the full path
  const fullPath = path.resolve(videoRoot, normalized);

  // Ensure the resolved path is within videoRoot
  const relative = path.relative(videoRoot, fullPath);

  // If relative path starts with '..' or is absolute, it's outside videoRoot
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new PathTraversalError('Access denied: path is outside video root');
  }

  return {
    absolutePath: fullPath,
    relativePath: normalized || ''
  };
}

// Get the parent directory path (relative)
function getParentPath(relativePath) {
  const normalized = normalizePath(relativePath);

  if (!normalized || normalized === '') {
    return null; // Already at root
  }

  const parent = path.dirname(normalized);

  // If parent is '.' that means we're at root
  if (parent === '.' || parent === '/') {
    return '';
  }

  return normalizePath(parent);
}

// Convert an absolute path to relative path from video root
function toRelativePath(videoRoot, absolutePath) {
  const relative = path.relative(videoRoot, absolutePath);

  // Ensure it's within video root
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new PathTraversalError('Path is outside video root');
  }

  return normalizePath(relative);
}

// Get a URL-safe path for use in API endpoints
function toUrlPath(relativePath) {
  const normalized = normalizePath(relativePath);

  if (!normalized || normalized === '') {
    return '';
  }

  // URL encode each path segment
  return normalized
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

// Decode a URL path back to filesystem path
function fromUrlPath(urlPath) {
  if (!urlPath || urlPath === '') {
    return '';
  }

  // Decode each path segment
  const decoded = urlPath
    .split('/')
    .map(segment => decodeURIComponent(segment))
    .join('/');

  return normalizePath(decoded);
}

module.exports = {
  normalizePath,
  validateAndResolvePath,
  getParentPath,
  toRelativePath,
  toUrlPath,
  fromUrlPath
};
