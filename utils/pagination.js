/**
 * Pagination utility functions
 * Provides consistent pagination calculation across the application
 */

/**
 * Calculate pagination metadata
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {object} Pagination metadata
 */
const getPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

/**
 * Calculate skip value for database queries
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @returns {number} Number of documents to skip
 */
const getSkip = (page, limit) => {
  return (page - 1) * limit;
};

/**
 * Execute paginated query and return results with metadata
 * @param {Model} model - Mongoose model
 * @param {object} filter - Query filter
 * @param {object} options - Query options
 * @param {number} options.page - Current page
 * @param {number} options.limit - Items per page
 * @param {object} [options.sort] - Sort criteria (default: { createdAt: -1 })
 * @param {string|object} [options.populate] - Population options
 * @returns {Promise<object>} { data, pagination }
 */
const paginateQuery = async (model, filter, options) => {
  const {
    page = 1,
    limit = 10,
    sort = { createdAt: -1 },
    populate = null,
  } = options;

  const skip = getSkip(page, limit);

  let query = model.find(filter).sort(sort).skip(skip).limit(limit);

  if (populate) {
    query = query.populate(populate);
  }

  const [data, total] = await Promise.all([
    query.exec(),
    model.countDocuments(filter),
  ]);

  return {
    data,
    pagination: getPaginationMeta(page, limit, total),
  };
};

module.exports = {
  getPaginationMeta,
  getSkip,
  paginateQuery,
};
