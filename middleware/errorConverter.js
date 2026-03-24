const ApiError = require("../utils/ApiError");
const { isDbError, mapDbError } = require("../utils/dbErrors");

/**
 * Error converter middleware
 * Converts any error to ApiError for consistent handling
 *
 * @param {Error} err - Original error
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
const errorConverter = (err, req, res, next) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    let statusCode = 500;
    let message = error.message || "Internal server error";
    let isOperational = false;

    // Handle database errors
    if (isDbError(err)) {
      const { dbMessage, dbStatusCode } = mapDbError(err);
      if (dbMessage) {
        message = dbMessage;
        statusCode = dbStatusCode;
        isOperational = true;
      }
    }

    // Handle JWT errors
    if (err.name === "JsonWebTokenError") {
      message = "Invalid token.";
      statusCode = 401;
      isOperational = true;
    }

    if (err.name === "TokenExpiredError") {
      message = "Token expired.";
      statusCode = 401;
      isOperational = true;
    }

    // Handle SyntaxError (e.g., invalid JSON in request body)
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
      message = "Invalid JSON in request body.";
      statusCode = 400;
      isOperational = true;
    }

    // Build stack trace
    const stack = err.cause
      ? `${err.cause}\n======================================\n${err.stack}`
      : error.stack;

    error = new ApiError(statusCode, { message }, isOperational, stack);
  }

  next(error);
};

module.exports = errorConverter;
