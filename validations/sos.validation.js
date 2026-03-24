const { z } = require("zod/v4");

/**
 * Reusable schema for MongoDB ObjectId validation
 */
const mongoIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ID format");

/**
 * Location schema for SOS trigger
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
 * TRIGGER SOS - POST /api/sos/trigger
 */
const triggerSosSchema = z.object({
  body: locationSchema,
});

/**
 * CONFIRM SOS - POST /api/sos/confirm/:id
 */
const confirmSosSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
  }),
});

/**
 * CANCEL SOS - POST /api/sos/cancel/:id
 */
const cancelSosSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
  }),
});

/**
 * GET SOS BY ID - GET /api/sos/:id
 */
const getSosByIdSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
  }),
});

/**
 * GET SOS HISTORY - GET /api/sos/history
 */
const getSosHistorySchema = z.object({
  query: z
    .object({
      status: z.enum(["active", "confirmed", "cancelled"]).optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(10),
    })
    .optional()
    .default({}),
});

module.exports = {
  triggerSosSchema,
  confirmSosSchema,
  cancelSosSchema,
  getSosByIdSchema,
  getSosHistorySchema,
};
