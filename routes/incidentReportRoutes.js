const express = require("express");
const router = express.Router();

const IncidentReport = require("../models/IncidentReport");
const EmergencyContact = require("../models/EmergencyContact");
const User = require("../models/User");

const { auth } = require("../middleware/auth");
const validator = require("../middleware/validator");
const catchAsync = require("../utils/catchAsync");

const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");

const { sendIncidentAlert } = require("../utils/sendSMS");
const { assertOwnership } = require("../utils/checkOwnership");
const { getPaginationMeta, getSkip } = require("../utils/pagination");

const {
  createIncidentSchema,
  getIncidentsSchema,
  getIncidentByIdSchema,
  updateIncidentSchema,
  deleteIncidentSchema,
  viewIncidentSchema,
} = require("../validations/incidentReport.validation");


// ==========================================
// 🚨 CREATE INCIDENT
// POST /api/incidents
// ==========================================
router.post(
  "/",
  auth,
  validator(createIncidentSchema),
  catchAsync(async (req, res) => {
    const { title, description, type, customType, location, occurredAt } =
      req.body;

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

    // 🔹 Get contacts
    const contacts = await EmergencyContact.find({
      user: req.user._id,
      isActive: true,
    }).sort({ priority: 1 });

    let notificationSummary = {
      total: contacts.length,
      sent: 0,
      failed: 0,
    };

    if (contacts.length > 0) {
      const user = await User.findById(req.user._id);

      const notificationResults = await sendIncidentAlert(
        incident,
        user,
        contacts
      );

      incident.notifiedContacts = notificationResults;
      await incident.save();

      notificationSummary.sent = notificationResults.filter(
        (n) => n.status === "sent"
      ).length;

      notificationSummary.failed = notificationResults.filter(
        (n) => n.status === "failed"
      ).length;
    }

    let message = "Incident reported successfully.";
    if (contacts.length === 0) {
      message += " No emergency contacts configured.";
    } else if (notificationSummary.failed === 0) {
      message += ` ${notificationSummary.sent} contact(s) notified.`;
    } else {
      message += ` ${notificationSummary.sent}/${notificationSummary.total} notified, ${notificationSummary.failed} failed.`;
    }

    return ApiResponse.created(res, message, {
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


// ==========================================
// 📄 GET INCIDENTS (PAGINATED)
// GET /api/incidents
// ==========================================
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

    if (type) query.type = type;

    const sort = { [sortBy]: order === "asc" ? 1 : -1 };

    const skip = getSkip(page, limit);

    const [incidents, total] = await Promise.all([
      IncidentReport.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select("-__v"),
      IncidentReport.countDocuments(query),
    ]);

    const pagination = getPaginationMeta(page, limit, total);

    return ApiResponse.ok(res, "Incidents fetched successfully", {
      count: incidents.length,
      incidents,
      pagination,
    });
  })
);


// ==========================================
// 🌐 PUBLIC VIEW (FOR CONTACTS)
// GET /api/incidents/view/:viewToken
// ==========================================
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
      throw ApiError.notFound("Incident not found.");
    }

    return ApiResponse.ok(res, "Incident fetched", {
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


// ==========================================
// 📄 GET SINGLE INCIDENT
// GET /api/incidents/:id
// ==========================================
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

    assertOwnership(incident.user, req.user._id, "incident");

    return ApiResponse.ok(res, "Incident fetched", { incident });
  })
);


// ==========================================
// ✏️ UPDATE INCIDENT
// PATCH /api/incidents/:id
// ==========================================
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

    assertOwnership(incident.user, req.user._id, "incident");

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

    return ApiResponse.ok(res, "Incident updated", { incident });
  })
);


// ==========================================
// 🗑 DELETE INCIDENT
// DELETE /api/incidents/:id
// ==========================================
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

    assertOwnership(incident.user, req.user._id, "incident");

    await IncidentReport.findByIdAndDelete(id);

    return ApiResponse.ok(res, "Incident deleted successfully");
  })
);


module.exports = router;