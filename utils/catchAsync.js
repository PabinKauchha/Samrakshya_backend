/**
 * Higher-order function to wrap async route handlers
 * Eliminates need for try-catch in every controller
 * Automatically forwards errors to Express error handler
 *
 * @param {Function} fn - Async route handler function
 * @returns {Function} - Express middleware function
 *
 * @example
 * router.get("/", auth, catchAsync(async (req, res) => {
 *   const items = await Model.find();
 *   ApiResponse.ok(res, "Items fetched", { items });
 * }));
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync;
