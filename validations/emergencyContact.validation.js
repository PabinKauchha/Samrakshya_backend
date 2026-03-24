const { z } = require("zod/v4");
const { RELATIONSHIPS_ARRAY } = require("../constants/relationships");
const { mongoIdSchema, mongoIdParamsSchema, phoneSchema } = require("./common");

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
  params: mongoIdParamsSchema,
});

/**
 * UPDATE - PATCH /api/emergency-contacts/:id
 */
const updateContactSchema = z.object({
  params: mongoIdParamsSchema,
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
  params: mongoIdParamsSchema,
});

module.exports = {
  createContactSchema,
  getContactsSchema,
  getContactByIdSchema,
  updateContactSchema,
  deleteContactSchema,
};
