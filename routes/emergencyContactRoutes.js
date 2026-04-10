const express = require("express");
const EmergencyContact = require("../models/EmergencyContact");
const { auth } = require("../middleware/auth");
const validator = require("../middleware/validator");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { assertOwnership } = require("../utils/checkOwnership");
const {
  createContactSchema,
  getContactsSchema,
  getContactByIdSchema,
  updateContactSchema,
  deleteContactSchema,
} = require("../validations/emergencyContact.validation");

const router = express.Router();

/**
 * @route   POST /api/emergency-contacts
 * @desc    Create a new emergency contact
 * @access  Private
 */
router.post(
  "/",
  auth,
  validator(createContactSchema),
  catchAsync(async (req, res) => {
    const { name, phone, relationship, priority } = req.body;

    // Check if contact with same phone already exists for this user
    const existingContact = await EmergencyContact.findOne({
      user: req.user._id,
      phone,
    });

    if (existingContact) {
      throw ApiError.conflict("A contact with this phone number already exists.");
    }

    const contact = new EmergencyContact({
      user: req.user._id,
      name,
      phone,
      relationship,
      priority,
    });

    await contact.save();

    ApiResponse.created(res, "Emergency contact created successfully.", {
      emergencyContact: contact,
    });
  })
);

/**
 * @route   GET /api/emergency-contacts
 * @desc    Get all emergency contacts for the authenticated user
 * @access  Private
 */
router.get(
  "/",
  auth,
  validator(getContactsSchema),
  catchAsync(async (req, res) => {
    const query = { user: req.user._id };

    // Filter by isActive if provided
    if (req.query?.isActive !== undefined) {
      query.isActive = req.query.isActive;
    }

    const contacts = await EmergencyContact.find(query)
      .sort({ priority: 1, createdAt: 1 })
      .select("-__v");

    ApiResponse.ok(res, "Emergency contacts fetched successfully.", {
      count: contacts.length,
      emergencyContacts: contacts,
    });
  })
);

/**
 * @route   GET /api/emergency-contacts/:id
 * @desc    Get a single emergency contact by ID
 * @access  Private
 */
router.get(
  "/:id",
  auth,
  validator(getContactByIdSchema),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const contact = await EmergencyContact.findById(id).select("-__v");

    if (!contact) {
      throw ApiError.notFound("Emergency contact not found.");
    }

    assertOwnership(contact.user, req.user._id, "contact");

    ApiResponse.ok(res, "Emergency contact fetched successfully.", {
      emergencyContact: contact,
    });
  })
);

router.delete(
  "/:id",
  auth,
  validator(deleteContactSchema),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const contact = await EmergencyContact.findById(id);

    if (!contact) {
      throw ApiError.notFound("Emergency contact not found.");
    }

    assertOwnership(contact.user, req.user._id, "contact");

    await EmergencyContact.findByIdAndDelete(id);

    ApiResponse.ok(res, "Emergency contact deleted successfully.");
  })
);

/**
 * @route   PATCH /api/emergency-contacts/:id
 * @desc    Update an emergency contact
 * @access  Private
 */
router.patch(
  "/:id",
  auth,
  validator(updateContactSchema),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const contact = await EmergencyContact.findById(id);

    if (!contact) {
      throw ApiError.notFound("Emergency contact not found.");
    }

    assertOwnership(contact.user, req.user._id, "contact");

    // Check if updating phone to one that already exists
    if (req.body.phone && req.body.phone !== contact.phone) {
      const existingContact = await EmergencyContact.findOne({
        user: req.user._id,
        phone: req.body.phone,
        _id: { $ne: id },
      });

      if (existingContact) {
        throw ApiError.conflict("A contact with this phone number already exists.");
      }
    }

    // Update fields
    const allowedUpdates = [
      "name",
      "phone",
      "relationship",
      "priority",
      "isActive",
      "priority"
    ];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        contact[field] = req.body[field];
      }
    });

    await contact.save();

    ApiResponse.ok(res, "Emergency contact updated successfully.", {
      emergencyContact: contact,
    });
  })
);

/**
 * @route   DELETE /api/emergency-contacts/:id
 * @desc    Delete an emergency contact
 * @access  Private
 */
router.delete(
  "/:id",
  auth,
  validator(deleteContactSchema),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const contact = await EmergencyContact.findById(id);

    if (!contact) {
      throw ApiError.notFound("Emergency contact not found.");
    }

    assertOwnership(contact.user, req.user._id, "contact");

    await EmergencyContact.findByIdAndDelete(id);

    ApiResponse.ok(res, "Emergency contact deleted successfully.");
  })
);

module.exports = router;
