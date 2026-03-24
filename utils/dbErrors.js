/**
 * Database error detection and mapping utilities
 * Handles Mongoose-specific errors
 */

/**
 * Check if error is a database/Mongoose error
 * @param {Error} err
 * @returns {boolean}
 */
const isDbError = (err) => {
  return (
    err.name === "ValidationError" ||
    err.name === "CastError" ||
    err.code === 11000 ||
    err.name === "MongoServerError"
  );
};

/**
 * Map database error to user-friendly message and status code
 * @param {Error} err
 * @returns {{ dbMessage: string, dbStatusCode: number }}
 */
const mapDbError = (err) => {
  let dbMessage = "";
  let dbStatusCode = 400;

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    dbMessage = messages.join(". ");
    dbStatusCode = 400;
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    dbMessage = `Duplicate value for ${field}.`;
    dbStatusCode = 409;
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === "CastError") {
    dbMessage = `Invalid ${err.path}: ${err.value}`;
    dbStatusCode = 400;
  }

  return { dbMessage, dbStatusCode };
};

module.exports = { isDbError, mapDbError };
