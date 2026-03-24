const { z } = require("zod/v4");
const {
  INCIDENT_TYPES,
  INCIDENT_TYPES_ARRAY,
} = require("../constants/incidentTypes");
const {
  mongoIdParamsSchema,
  locationWithAddressSchema,
  paginationQuerySchema,
} = require("./common");

/**
 * CREATE - POST /api/incidents
 */
const createIncidentSchema = z.object({
  body: z
    .object({
      title: z
        .string()
        .trim()
        .min(1, "Title is required")
        .max(200, "Title must be at most 200 characters"),
      description: z
        .string()
        .trim()
        .min(1, "Description is required")
        .max(2000, "Description must be at most 2000 characters"),
      type: z.enum(INCIDENT_TYPES_ARRAY, {
        message: "Invalid incident type",
      }),
      customType: z
        .string()
        .trim()
        .max(100, "Custom type must be at most 100 characters")
        .optional(),
      location: locationWithAddressSchema,
      occurredAt: z.coerce.date({
        message: "Invalid date format for occurredAt",
      }),
    })
    .refine(
      (data) =>
        data.type !== INCIDENT_TYPES.OTHER ||
        (data.customType && data.customType.length > 0),
      {
        message: "customType is required when type is 'other'",
        path: ["customType"],
      }
    ),
});

/**
 * GET ALL - GET /api/incidents
 */
const getIncidentsSchema = z.object({
  query: paginationQuerySchema
    .extend({
      type: z.enum(INCIDENT_TYPES_ARRAY).optional(),
      sortBy: z.enum(["createdAt", "occurredAt"]).default("createdAt"),
      order: z.enum(["asc", "desc"]).default("desc"),
    })
    .optional()
    .default({}),
});

/**
 * GET ONE - GET /api/incidents/:id
 */
const getIncidentByIdSchema = z.object({
  params: mongoIdParamsSchema,
});

/**
 * UPDATE - PATCH /api/incidents/:id
 */
const updateIncidentSchema = z.object({
  params: mongoIdParamsSchema,
  body: z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().max(2000).optional(),
      type: z.enum(INCIDENT_TYPES_ARRAY).optional(),
      customType: z.string().trim().max(100).optional(),
      location: locationWithAddressSchema.optional(),
      occurredAt: z.coerce.date().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided for update",
    }),
});

/**
 * DELETE - DELETE /api/incidents/:id
 */
const deleteIncidentSchema = z.object({
  params: mongoIdParamsSchema,
});

/**
 * PUBLIC VIEW - GET /api/incidents/view/:viewToken
 */
const viewIncidentSchema = z.object({
  params: z.object({
    viewToken: z
      .string()
      .min(32, "Invalid view token")
      .max(64, "Invalid view token"),
  }),
});

module.exports = {
  createIncidentSchema,
  getIncidentsSchema,
  getIncidentByIdSchema,
  updateIncidentSchema,
  deleteIncidentSchema,
  viewIncidentSchema,
};
