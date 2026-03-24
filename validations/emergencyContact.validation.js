const { z } = require("zod/v4");
const { RELATIONSHIPS_ARRAY } = require("../constants/relationships");

/**
 * Reusable schema for MongoDB ObjectId validation
 */
const mongoIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ID format");

/**
 * Phone number validation schema
 * Supports international format with optional + prefix
 */
const phoneSchema = z
  .string()
  .min(10, "Phone must be at least 10 digits")
  .max(15, "Phone must be at most 15 digits")
  .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone format");

/**
 * CREATE - POST /api/emergency-contacts
 */
const createContactSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(100, "Name must be at most 100 characters"),
    phone: phoneSchema,
    relationship: z.enum(RELATIONSHIPS_ARRAY, {
      message: "Invalid relationship type",
    }),
    priority: z.coerce.number().int().min(1).max(10).default(1),
  }),
});

/**
 * GET ALL - GET /api/emergency-contacts
 */
const getContactsSchema = z.object({
  query: z
    .object({
      isActive: z
        .enum(["true", "false"])
        .optional()
        .transform((v) => (v === undefined ? undefined : v === "true")),
    })
    .optional(),
});

/**
 * GET ONE - GET /api/emergency-contacts/:id
 */
const getContactByIdSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
  }),
});

/**
 * UPDATE - PATCH /api/emergency-contacts/:id
 */
const updateContactSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
  }),
  body: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      phone: phoneSchema.optional(),
      relationship: z.enum(RELATIONSHIPS_ARRAY).optional(),
      priority: z.coerce.number().int().min(1).max(10).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided for update",
    }),
});

/**
 * DELETE - DELETE /api/emergency-contacts/:id
 */
const deleteContactSchema = z.object({
  params: z.object({
    id: mongoIdSchema,
  }),
});

module.exports = {
  createContactSchema,
  getContactsSchema,
  getContactByIdSchema,
  updateContactSchema,
  deleteContactSchema,
};
