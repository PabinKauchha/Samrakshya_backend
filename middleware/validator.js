const { z, ZodError } = require("zod/v4");

/**
 * Zod validation middleware
 * Validates params, query, and body against provided schema
 * Replaces req.params, req.query, req.body with validated/transformed data
 *
 * @example
 * const exampleSchema = z.object({
 *   params: z.object({
 *     id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ID format"),
 *   }),
 *   query: z.object({
 *     page: z.coerce.number().positive().default(1),
 *     limit: z.coerce.number().positive().max(100).default(10),
 *   }),
 *   body: z.object({
 *     name: z.string().min(2, "Name must be at least 2 characters"),
 *     email: z.email("Invalid email format"),
 *   }),
 * });
 *
 * router.post("/example/:id", validator(exampleSchema), handler);
 */
const validator = (schema) => {
  return async (req, res, next) => {
    try {
      const result = await schema.safeParseAsync({
        params: req.params,
        query: req.query,
        body: req.body,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: z.treeifyError(result.error),
        });
      }

      // Replace with validated/transformed data
      if (result.data.params) {
        Object.defineProperty(req, "params", {
          value: result.data.params,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }

      if (result.data.query) {
        Object.defineProperty(req, "query", {
          value: result.data.query,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }

      if (result.data.body) {
        Object.defineProperty(req, "body", {
          value: result.data.body,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: z.treeifyError(error),
        });
      }

      console.error("Validator middleware error:", error);
      return res.status(400).json({
        success: false,
        message: "Unexpected validation error",
      });
    }
  };
};

module.exports = validator;
