const express = require("express");
const IncidentReport = require("../models/IncidentReport");
const EmergencyContact = require("../models/EmergencyContact");
const User = require("../models/User");
const { auth } = require("../middleware/auth");
const validator = require("../middleware/validator");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { sendIncidentAlert } = require("../utils/sendSMS");
const {
  createIncidentSchema,
  getIncidentsSchema,
  getIncidentByIdSchema,
  updateIncidentSchema,
  deleteIncidentSchema,
  viewIncidentSchema,
} = require("../validations/incidentReport.validation");

const router = express.Router();

/**
 * @route   POST /api/incidents
 * @desc    Create a new incident report and notify emergency contacts
 * @access  Private
 */
router.post(
  "/",
  auth,
  validator(createIncidentSchema),
  catchAsync(async (req, res) => {
    const { title, description, type, customType, location, occurredAt } =
      req.body;

    // Create incident
    const incident = new IncidentReport({
      user: req.user._id,
      title,
      description,
      type,
      customType,
      location,
      occurredAt,
    });

    await incident.save();

    // Get user's active emergency contacts
    const contacts = await EmergencyContact.find({
      user: req.user._id,
      isActive: true,
    }).sort({ priority: 1 });

    let notificationSummary = {
      total: contacts.length,
      sent: 0,
      failed: 0,
    };

    // Send notifications if there are contacts
    if (contacts.length > 0) {
      const user = await User.findById(req.user._id);
      const notificationResults = await sendIncidentAlert(
        incident,
        user,
        contacts
      );

      // Update incident with notification results
      incident.notifiedContacts = notificationResults;
      await incident.save();

      // Calculate summary
      notificationSummary.sent = notificationResults.filter(
        (n) => n.status === "sent"
      ).length;
      notificationSummary.failed = notificationResults.filter(
        (n) => n.status === "failed"
      ).length;
    }

    // Build response message
    let message = "Incident reported successfully.";
    if (contacts.length === 0) {
      message +=
        " No emergency contacts configured - no notifications were sent.";
    } else if (notificationSummary.failed === 0) {
      message += ` ${notificationSummary.sent} emergency contact(s) notified.`;
    } else {
      message += ` ${notificationSummary.sent} of ${notificationSummary.total} contact(s) notified. ${notificationSummary.failed} notification(s) failed.`;
    }

    ApiResponse.created(res, message, {
      incident: {
        _id: incident._id,
        title: incident.title,
        description: incident.description,
        type: incident.type,
        customType: incident.customType,
        displayType: incident.displayType,
        location: incident.location,
        occurredAt: incident.occurredAt,
        viewToken: incident.viewToken,
        notifiedContacts: incident.notifiedContacts.map((nc) => ({
          name: nc.name,
          status: nc.status,
          failureReason: nc.failureReason,
        })),
        createdAt: incident.createdAt,
      },
      notifications: notificationSummary,
    });
  })
);

/**
 * @route   GET /api/incidents
 * @desc    Get all incidents for the authenticated user (paginated)
 * @access  Private
 */
router.get(
  "/",
  auth,
  validator(getIncidentsSchema),
  catchAsync(async (req, res) => {
    const {
      type,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
    } = req.query || {};

    const query = { user: req.user._id };

    // Filter by type if provided
    if (type) {
      query.type = type;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sort = { [sortBy]: order === "asc" ? 1 : -1 };

    // Execute query with pagination
    const [incidents, total] = await Promise.all([
      IncidentReport.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select("-__v"),
      IncidentReport.countDocuments(query),
    ]);

    ApiResponse.ok(res, "Incidents fetched successfully.", {
      count: incidents.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      incidents,
    });
  })
);

/**
 * @route   GET /api/incidents/view/:viewToken
 * @desc    Public view of incident for notified contacts
 * @access  Public
 */
router.get(
  "/view/:viewToken",
  validator(viewIncidentSchema),
  catchAsync(async (req, res) => {
    const { viewToken } = req.params;

    const incident = await IncidentReport.findOne({ viewToken })
      .populate("user", "name")
      .select(
        "title description type customType location occurredAt createdAt user"
      );

    if (!incident) {
      throw ApiError.notFound("Incident not found or invalid view link.");
    }

    // Return limited information for public view
    ApiResponse.ok(res, "Incident fetched successfully.", {
      incident: {
        title: incident.title,
        description: incident.description,
        type: incident.type,
        customType: incident.customType,
        displayType: incident.displayType,
        location: incident.location,
        occurredAt: incident.occurredAt,
        reportedBy: incident.user?.name || "Unknown",
        reportedAt: incident.createdAt,
      },
    });
  })
);

/**
 * @route   GET /api/incidents/:id
 * @desc    Get a single incident by ID
 * @access  Private
 */
router.get(
  "/:id",
  auth,
  validator(getIncidentByIdSchema),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const incident = await IncidentReport.findById(id)
      .populate("notifiedContacts.contact", "name phone relationship")
      .select("-__v");

    if (!incident) {
      throw ApiError.notFound("Incident not found.");
    }

    // Check ownership
    if (incident.user.toString() !== req.user._id.toString()) {
      throw ApiError.forbidden("Not authorized to access this incident.");
    }

    ApiResponse.ok(res, "Incident fetched successfully.", {
      incident,
    });
  })
);

/**
 * @route   PATCH /api/incidents/:id
 * @desc    Update an incident report
 * @access  Private
 */
router.patch(
  "/:id",
  auth,
  validator(updateIncidentSchema),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const incident = await IncidentReport.findById(id);

    if (!incident) {
      throw ApiError.notFound("Incident not found.");
    }

    // Check ownership
    if (incident.user.toString() !== req.user._id.toString()) {
      throw ApiError.forbidden("Not authorized to update this incident.");
    }

    // Update fields
    const allowedUpdates = [
      "title",
      "description",
      "type",
      "customType",
      "location",
      "occurredAt",
    ];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        incident[field] = req.body[field];
      }
    });

    await incident.save();

    ApiResponse.ok(res, "Incident updated successfully.", {
      incident,
    });
  })
);

/**
 * @route   DELETE /api/incidents/:id
 * @desc    Delete an incident report
 * @access  Private
 */
router.delete(
  "/:id",
  auth,
  validator(deleteIncidentSchema),
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const incident = await IncidentReport.findById(id);

    if (!incident) {
      throw ApiError.notFound("Incident not found.");
    }

    // Check ownership
    if (incident.user.toString() !== req.user._id.toString()) {
      throw ApiError.forbidden("Not authorized to delete this incident.");
    }

    await IncidentReport.findByIdAndDelete(id);

    ApiResponse.ok(res, "Incident deleted successfully.");
  })
);

module.exports = router;
