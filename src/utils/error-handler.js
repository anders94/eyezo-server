// Base error class for Eyezo Server errors
class VideoServerError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 404 - Resource not found
class NotFoundError extends VideoServerError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

// 400 - Invalid request parameters
class ValidationError extends VideoServerError {
  constructor(message = 'Invalid request') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

// 403 - Path traversal or security violation
class PathTraversalError extends VideoServerError {
  constructor(message = 'Path traversal not allowed') {
    super(message, 403, 'PATH_TRAVERSAL');
  }
}

// 416 - Range not satisfiable
class RangeNotSatisfiableError extends VideoServerError {
  constructor(message = 'Range not satisfiable') {
    super(message, 416, 'RANGE_NOT_SATISFIABLE');
  }
}

// 500 - Generic server error
class InternalServerError extends VideoServerError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR');
  }
}

// Centralized error handler middleware for Fastify
function setupErrorHandler(fastify) {
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    const code = error.code || 'INTERNAL_ERROR';

    // Log error with context
    request.log.error({
      err: error,
      url: request.url,
      method: request.method,
      statusCode,
      code
    });

    // Send safe response (don't expose internal details in production)
    reply.code(statusCode).send({
      error: error.message,
      code: code,
      statusCode: statusCode
    });
  });
}

module.exports = {
  VideoServerError,
  NotFoundError,
  ValidationError,
  PathTraversalError,
  RangeNotSatisfiableError,
  InternalServerError,
  setupErrorHandler
};
