const express = require("express");
const router = express.Router();

const SOS = require("../models/sos");
const { SOS_STATUS } = require("../models/sos");
const EmergencyContact = require("../models/EmergencyContact");
const { auth } = require("../middleware/auth");
const validator = require("../middleware/validator");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { sendSMS } = require("../utils/sendSMS");
const { assertOwnership } = require("../utils/checkOwnership");
const { getPaginationMeta, getSkip } = require("../utils/pagination");

const {
  triggerSosSchema,
  confirmSosSchema,
  cancelSosSchema,
  getSosByIdSchema,
  getSosHistorySchema,
} = require("../validations/sos.validation");

/**
 * Send SOS alert to a single contact
 * @param {object} contact - Emergency contact document
 * @param {object} user - User who triggered SOS
 * @param {string} locationLink - Google Maps link
 * @param {string} sosId - SOS event ID
 * @returns {Promise<object>} - Notification result
 */
const sendSosAlert = async (contact, user, locationLink, sosId) => {
  const confirmLink = `${process.env.BASE_URL || "http://localhost:3000"}/api/sos/confirm/${sosId}`;

  const message = `EMERGENCY SOS from ${user.name}!

${user.name} may be in danger and needs help.

Location: ${locationLink}

Please check on them immediately.

Confirm you received this alert: ${confirmLink}

This is an automated alert from Samrakshya Safety App.`;

  try {
    await sendSMS(contact.phone, message);
    return {
      contact: contact._id,
      name: contact.name,
      phone: contact.phone,
      notifiedAt: new Date(),
      status: "sent",
    };
  } catch (error) {
    console.error(`[SOS] Failed to notify ${contact.phone}:`, error.message);
    return {
      contact: contact._id,
      name: contact.name,
      phone: contact.phone,
      notifiedAt: new Date(),
      status: "failed",
      failureReason: error.message,
    };
  }
};

/**
 * TRIGGER SOS - POST /api/sos/trigger
 * Requires authentication
 * Notifies all emergency contacts immediately (no escalation delays)
 */
router.post(
  "/trigger",
  auth,
  validator(triggerSosSchema),
  catchAsync(async (req, res) => {
    const { latitude, longitude } = req.body;
    const user = req.user;

    // Check if user has an active SOS already
    const existingActive = await SOS.findOne({
      user: user._id,
      status: SOS_STATUS.ACTIVE,
    });

    if (existingActive) {
      throw ApiError.badRequest(
        "You already have an active SOS. Please cancel or confirm it before triggering a new one."
      );
    }

    // Get user's emergency contacts
    const contacts = await EmergencyContact.find({ user: user._id });

    if (!contacts || contacts.length === 0) {
      throw ApiError.badRequest(
        "No emergency contacts found. Please add emergency contacts before triggering SOS."
      );
    }

    const locationLink = `https://maps.google.com/?q=${latitude},${longitude}`;

    // Create SOS event
    const sosEvent = new SOS({
      user: user._id,
      latitude,
      longitude,
      locationLink,
      status: SOS_STATUS.ACTIVE,
    });

    await sosEvent.save();

    console.log(`[SOS] TRIGGERED by ${user.email}`);
    console.log(`[SOS] Location: ${locationLink}`);

    // Notify ALL contacts immediately (no escalation delays)
    const notificationResults = await Promise.all(
      contacts.map((contact) =>
        sendSosAlert(contact, user, locationLink, sosEvent._id)
      )
    );

    // Update SOS with notified contacts
    sosEvent.notifiedContacts = notificationResults.map((result) => ({
      contact: result.contact,
      name: result.name,
      phone: result.phone,
      notifiedAt: result.notifiedAt,
    }));

    await sosEvent.save();

    const successCount = notificationResults.filter(
      (r) => r.status === "sent"
    ).length;

    console.log(
      `[SOS] Notified ${successCount}/${contacts.length} contacts`
    );

    res
      .status(201)
      .json(
        ApiResponse.created(
          {
            sosId: sosEvent._id,
            location: locationLink,
            contactsNotified: successCount,
            totalContacts: contacts.length,
          },
          "SOS triggered successfully. All emergency contacts have been notified."
        )
      );
  })
);

/**
 * CONFIRM SOS - POST /api/sos/confirm/:id
 * Can be accessed without authentication (for contacts clicking the link)
 * Marks SOS as confirmed (user is safe)
 */
router.post(
  "/confirm/:id",
  validator(confirmSosSchema),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const sosEvent = await SOS.findById(id);

    if (!sosEvent) {
      throw ApiError.notFound("SOS event not found");
    }

    if (sosEvent.status !== SOS_STATUS.ACTIVE) {
      return res.json(
        ApiResponse.success(
          { status: sosEvent.status },
          `This SOS has already been ${sosEvent.status}.`
        )
      );
    }

    sosEvent.status = SOS_STATUS.CONFIRMED;
    sosEvent.confirmedAt = new Date();
    await sosEvent.save();

    console.log(`[SOS] CONFIRMED - Event ${id}`);

    res.json(
      ApiResponse.success(
        { sosId: sosEvent._id, status: sosEvent.status },
        "SOS confirmed. Thank you for responding."
      )
    );
  })
);

/**
 * GET /api/sos/confirm/:id - Allow GET for link clicks
 * Displays a simple confirmation page or redirects
 */
router.get(
  "/confirm/:id",
  validator(confirmSosSchema),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const sosEvent = await SOS.findById(id);

    if (!sosEvent) {
      throw ApiError.notFound("SOS event not found");
    }

    if (sosEvent.status !== SOS_STATUS.ACTIVE) {
      return res.send(
        `<html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1>SOS Alert</h1>
          <p>This SOS has already been ${sosEvent.status}.</p>
        </body></html>`
      );
    }

    sosEvent.status = SOS_STATUS.CONFIRMED;
    sosEvent.confirmedAt = new Date();
    await sosEvent.save();

    console.log(`[SOS] CONFIRMED via GET - Event ${id}`);

    res.send(
      `<html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: green;">✓ Alert Confirmed</h1>
        <p>Thank you for responding to the SOS alert.</p>
        <p>The user has been marked as safe.</p>
      </body></html>`
    );
  })
);

/**
 * CANCEL SOS - POST /api/sos/cancel/:id
 * Requires authentication - only the user who triggered can cancel
 */
router.post(
  "/cancel/:id",
  auth,
  validator(cancelSosSchema),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    const sosEvent = await SOS.findById(id);

    if (!sosEvent) {
      throw ApiError.notFound("SOS event not found");
    }

    assertOwnership(sosEvent.user, user._id, "SOS event");

    if (sosEvent.status !== SOS_STATUS.ACTIVE) {
      throw ApiError.badRequest(
        `Cannot cancel SOS that has already been ${sosEvent.status}`
      );
    }

    sosEvent.status = SOS_STATUS.CANCELLED;
    await sosEvent.save();

    console.log(`[SOS] CANCELLED by ${user.email} - Event ${id}`);

    res.json(
      ApiResponse.success(
        { sosId: sosEvent._id, status: sosEvent.status },
        "SOS cancelled successfully"
      )
    );
  })
);

/**
 * GET SOS HISTORY - GET /api/sos/history
 * Requires authentication - returns user's SOS history with pagination
 * NOTE: Must be defined BEFORE /:id route
 */
router.get(
  "/history",
  auth,
  validator(getSosHistorySchema),
  catchAsync(async (req, res) => {
    const user = req.user;
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { user: user._id };
    if (status) {
      filter.status = status;
    }

    const skip = getSkip(page, limit);
    const [history, total] = await Promise.all([
      SOS.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("notifiedContacts.contact", "name phone relationship"),
      SOS.countDocuments(filter),
    ]);

    const pagination = getPaginationMeta(page, limit, total);

    res.json(
      ApiResponse.success({
        history,
        pagination,
      })
    );
  })
);

/**
 * GET ACTIVE SOS - GET /api/sos/active
 * Requires authentication - returns user's currently active SOS (if any)
 * NOTE: Must be defined BEFORE /:id route
 */
router.get(
  "/active",
  auth,
  catchAsync(async (req, res) => {
    const user = req.user;

    const activeSos = await SOS.findOne({
      user: user._id,
      status: SOS_STATUS.ACTIVE,
    }).populate("notifiedContacts.contact", "name phone relationship");

    res.json(
      ApiResponse.success(
        { activeSos },
        activeSos ? "Active SOS found" : "No active SOS"
      )
    );
  })
);

/**
 * GET SOS BY ID - GET /api/sos/:id
 * Requires authentication - only the owner can view
 * NOTE: Must be defined AFTER /history and /active routes
 */
router.get(
  "/:id",
  auth,
  validator(getSosByIdSchema),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    const sosEvent = await SOS.findById(id).populate(
      "notifiedContacts.contact",
      "name phone relationship"
    );

    if (!sosEvent) {
      throw ApiError.notFound("SOS event not found");
    }

    assertOwnership(sosEvent.user, user._id, "SOS event");

    res.json(ApiResponse.success(sosEvent));
  })
);

module.exports = router;
