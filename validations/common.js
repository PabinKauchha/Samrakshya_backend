const { z } = require("zod/v4");

/**
 * Common validation schemas shared across the application
 * Centralizes reusable Zod schemas to avoid duplication
 */

/**
 * MongoDB ObjectId validation schema
 * Validates 24-character hexadecimal string format
 */
const mongoIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ID format");

/**
 * MongoDB ObjectId params schema
 * For routes with :id parameter
 */
const mongoIdParamsSchema = z.object({
  id: mongoIdSchema,
});

/**
 * Location schema with latitude and longitude
 * Used for SOS triggers and incident reports
 */
const locationSchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
});

/**
 * Extended location schema with optional address
 * Used for incident reports where address can be provided
 */
const locationWithAddressSchema = locationSchema.extend({
  address: z.string().max(500, "Address too long").optional(),
});

/**
 * Pagination query schema
 * Provides default values for page and limit
 */
const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

/**
 * Phone number schema
 * Validates E.164 format or common formats
 */
const phoneSchema = z
  .string()
  .min(10, "Phone number must be at least 10 digits")
  .max(15, "Phone number too long")
  .regex(
    /^[+]?[\d\s-()]+$/,
    "Invalid phone format. Use digits, spaces, dashes, or parentheses"
  );

module.exports = {
  mongoIdSchema,
  mongoIdParamsSchema,
  locationSchema,
  locationWithAddressSchema,
  paginationQuerySchema,
  phoneSchema,
};
