/**
 * Custom API Error class for operational errors
 * Supports statusCode, message, error details, and isOperational flag
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {object} apiError - Error details { message: string, error?: any }
   * @param {boolean} isOperational - Whether error is operational (expected)
   * @param {string} stack - Optional stack trace
   */
  constructor(statusCode, apiError, isOperational = true, stack = "") {
    super(apiError.message || "An error occurred");
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.error = apiError.error;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Static factory methods for common errors
  static badRequest(message, error) {
    return new ApiError(400, { message, error });
  }

  static unauthorized(message = "Unauthorized", error) {
    return new ApiError(401, { message, error });
  }

  static forbidden(message = "Forbidden", error) {
    return new ApiError(403, { message, error });
  }

  static notFound(message = "Not found", error) {
    return new ApiError(404, { message, error });
  }

  static conflict(message = "Conflict", error) {
    return new ApiError(409, { message, error });
  }

  static internal(message = "Internal server error", error) {
    return new ApiError(500, { message, error }, false);
  }
}

module.exports = ApiError;
