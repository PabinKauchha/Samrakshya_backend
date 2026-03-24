const { z } = require("zod/v4");
const {
  INCIDENT_TYPES,
  INCIDENT_TYPES_ARRAY,
} = require("../constants/incidentTypes");

/**
 * Reusable schema for MongoDB ObjectId validation
 */
const mongoIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ID format");

/**
 * Location schema for incident reports
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
  address: z.string().max(500, "Address must be at most 500 characters").optional(),
});

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
      location: locationSchema,
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
  query: z
    .object({
      type: z.enum(INCIDENT_TYPES_ARRAY).optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(10),
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
  params: z.object({
    id: mongoIdSchema,
  }),
});

/**
 * UPDATE - PATCH /api/incidents/:id
 */
const updateIncidentSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
  }),
  body: z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().max(2000).optional(),
      type: z.enum(INCIDENT_TYPES_ARRAY).optional(),
      customType: z.string().trim().max(100).optional(),
      location: locationSchema.optional(),
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
  params: z.object({
    id: mongoIdSchema,
  }),
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
