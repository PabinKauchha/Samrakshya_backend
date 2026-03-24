const ApiError = require("./ApiError");

/**
 * Check if a user owns a resource
 * @param {ObjectId|string} resourceUserId - The user ID on the resource
 * @param {ObjectId|string} requestUserId - The authenticated user's ID
 * @returns {boolean} - True if user owns the resource
 */
const isOwner = (resourceUserId, requestUserId) => {
  return resourceUserId.toString() === requestUserId.toString();
};

/**
 * Assert that user owns the resource, throw ApiError if not
 * @param {ObjectId|string} resourceUserId - The user ID on the resource
 * @param {ObjectId|string} requestUserId - The authenticated user's ID
 * @param {string} [resourceName="resource"] - Name of resource for error message
 * @throws {ApiError} - 403 Forbidden if user doesn't own resource
 */
const assertOwnership = (resourceUserId, requestUserId, resourceName = "resource") => {
  if (!isOwner(resourceUserId, requestUserId)) {
    throw ApiError.forbidden(`You can only access your own ${resourceName}`);
  }
};

/**
 * Create a middleware that checks ownership of a resource
 * @param {Function} getResource - Async function (req) => resource that fetches the resource
 * @param {string} [resourceName="resource"] - Name of resource for error messages
 * @returns {Function} Express middleware
 */
const ownershipMiddleware = (getResource, resourceName = "resource") => {
  return async (req, res, next) => {
    try {
      const resource = await getResource(req);
      
      if (!resource) {
        throw ApiError.notFound(`${resourceName} not found`);
      }
      
      assertOwnership(resource.user, req.user._id, resourceName);
      
      // Attach resource to request for use in handler
      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  isOwner,
  assertOwnership,
  ownershipMiddleware,
};
