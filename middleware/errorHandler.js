/**
 * Final error handler middleware
 * Sends error response to client
 *
 * @param {import('../utils/ApiError')} err - ApiError instance
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  let { statusCode, message, error: errorDetails } = err;

  // In production, hide internal errors
  if (process.env.NODE_ENV === "production" && !err.isOperational) {
    statusCode = 500;
    message = "Internal server error";
  }

  // Store error message for logging/debugging
  res.locals.errorMessage = err.message;

  const response = {
    success: false,
    code: statusCode,
    message,
    ...(errorDetails && { error: errorDetails }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  };

  // Log error in development
  if (process.env.NODE_ENV === "development") {
    console.error("[ERROR]", err);
  } else if (!err.isOperational) {
    // Log non-operational errors in production too
    console.error("[ERROR]", err);
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
