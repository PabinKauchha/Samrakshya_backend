const { z } = require("zod/v4");
const {
  mongoIdParamsSchema,
  locationSchema,
  paginationQuerySchema,
} = require("./common");

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
  params: mongoIdParamsSchema,
});

/**
 * CANCEL SOS - POST /api/sos/cancel/:id
 */
const cancelSosSchema = z.object({
  params: mongoIdParamsSchema,
});

/**
 * GET SOS BY ID - GET /api/sos/:id
 */
const getSosByIdSchema = z.object({
  params: mongoIdParamsSchema,
});

/**
 * GET SOS HISTORY - GET /api/sos/history
 */
const getSosHistorySchema = z.object({
  query: paginationQuerySchema
    .extend({
      status: z.enum(["active", "confirmed", "cancelled"]).optional(),
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
