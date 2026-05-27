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
const { sendWhatsApp } = require("../utils/sendWhatsapp");

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
  const confirmLink = `${process.env.BASE_URL || "http://localhost:4321"}/api/sos/confirm/${sosId}`;
  const trackLink = `${process.env.BASE_URL || "http://localhost:4321"}/api/sos/track/${sosId}`;
  const shareBackLink = `${process.env.BASE_URL}/share-location.html?sosId=${sosId}`;
 const message = `EMERGENCY SOS from ${user.name}!

${user.name} may be in danger and needs help.

📍 Live Location:
${locationLink}

📲 Send your location back:
${shareBackLink}

✅ Confirm you received this alert:
${confirmLink}

This is an automated alert from Samrakshya Safety App.`;

  try {
    await sendSMS(contact.phone, message);

    await sendWhatsApp(contact.phone, message).catch((err) =>
      console.error(`[WhatsApp] Failed for ${contact.phone}:`, err.message)
    );

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

const escalateSOS = async (contacts, user, sosId) => {
  let contactIndex = 0;
  let tick = 0;

  while (contactIndex < contacts.length) {
    await new Promise((resolve) => setTimeout(resolve, 20000)); // 20 sec
    tick++;

    const updatedSOS = await SOS.findById(sosId);

    if (!updatedSOS || updatedSOS.status !== SOS_STATUS.ACTIVE) {
      console.log("🛑 SOS stopped. Ending escalation.");
      break;
    }

    const latestLocation = updatedSOS.locations?.length
      ? updatedSOS.locations[updatedSOS.locations.length - 1]
      : null;

    const locationLink = latestLocation
      ? `https://maps.google.com/?q=${latestLocation.lat},${latestLocation.lng}`
      : updatedSOS.locationLink;

    console.log(
  `[SOS] Tick ${tick} (${tick * 20}s) - Location: ${locationLink}`
);

    // 🔥 every 60 sec → next contact
    if (tick % 3 === 0) {
      const contact = contacts[contactIndex];
      console.log(`[SOS] Alerting ${contact.name}`);
      await sendSosAlert(contact, user, locationLink, sosId);
      contactIndex++;
    }
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

    const existingActive = await SOS.findOne({
      user: user._id,
      status: SOS_STATUS.ACTIVE,
    });

    if (existingActive) {
      throw ApiError.badRequest(
        "You already have an active SOS."
      );
    }

    const contacts = await EmergencyContact.find({ user: user._id });

    if (!contacts.length) {
      throw ApiError.badRequest("No emergency contacts found.");
    }

    const locationLink = `https://maps.google.com/?q=${latitude},${longitude}`;

    const sosEvent = new SOS({
      user: user._id,
      latitude,
      longitude,
      locationLink,
      status: SOS_STATUS.ACTIVE,
      locations: [
        {
          lat: latitude,
          lng: longitude,
        },
      ],
      lastAlertAt: new Date(),
    });

    await sosEvent.save();

    await sendSosAlert(contacts[0], user, locationLink, sosEvent._id);

      escalateSOS(contacts.slice(1), user, sosEvent._id)
      .catch(err => console.error("Escalation failed:", err));

    return ApiResponse.created(res, "SOS triggered successfully", {
      sosId: sosEvent._id,
      location: locationLink,
      totalContacts: contacts.length,
    });
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
    if (status) filter.status = status;

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

    // ✅ THIS IS THE ONLY CORRECT LINE
    return res.json(
      ApiResponse.success(
        {
          history,
          pagination,
        },
        "SOS history fetched successfully"
      )
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
// ==========================================
// POST /api/sos/guardian-location/:sosId
// ==========================================
router.post(
  "/guardian-location/:sosId",
  catchAsync(async (req, res) => {
    const { sosId } = req.params;
    const { lat, lng } = req.body;

    if (lat == null || lng == null) {
      throw ApiError.badRequest("Latitude and longitude required");
    }

    const sos = await SOS.findById(sosId);

    if (!sos) {
      throw ApiError.notFound("SOS not found");
    }

    // OPTIONAL: you can validate contact via phone/token later
   if (!sos.guardianLocations) {
  sos.guardianLocations = [];
}

sos.guardianLocations.push({
  lat,
  lng,
  timestamp: new Date(),
});

    await sos.save();

    res.json(ApiResponse.success(null, "Guardian location received"));
  })
);

router.get(
  "/track/:id",
  catchAsync(async (req, res) => {
    const { id } = req.params;

    const sosEvent = await SOS.findById(id);

    if (!sosEvent) {
      throw ApiError.notFound("SOS not found");
    }


   return res.json(
  ApiResponse.success(
    {
      sosEvent: {
        latitude: sos.latitude,
        longitude: sos.longitude,
        locations: sos.locations || [],
        guardianLocations: sos.guardianLocations || [],
      },
    },
    "Tracking data fetched"
  )
);
  })
);

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

router.post(
  "/location",
  auth,
  catchAsync(async (req, res) => {
    const { lat, lng } = req.body;

    if (lat == null || lng == null) {
      throw ApiError.badRequest("Latitude and longitude are required");
    }

    const sos = await SOS.findOne({
      user: req.user._id,
      status: SOS_STATUS.ACTIVE,
    });

    if (!sos) {
      throw ApiError.notFound("No active SOS found");
    }

    if (!sos.locations) {
      sos.locations = [];
    }

    sos.locations.push({
      lat,
      lng,
      timestamp: new Date(),
    });

    // keep only last 100 points
    if (sos.locations.length > 100) {
      sos.locations.shift();
    }

    // update latest location
    sos.latitude = lat;
    sos.longitude = lng;

    await sos.save();

    res.json(ApiResponse.success(null, "Location updated"));
  })
);


router.post(
  "/alert",
  auth,
  catchAsync(async (req, res) => {
    const sos = await SOS.findOne({
      user: req.user._id,
      status: SOS_STATUS.ACTIVE,
    });

    if (!sos) {
      throw ApiError.notFound("No active SOS found");
    }

    // ⛔ prevent spam (60 sec cooldown)
    if (sos.lastAlertAt && Date.now() - sos.lastAlertAt < 60000) {
      return res.json(ApiResponse.success(null, "Cooldown active"));
    }

    const user = req.user;

    const contacts = await EmergencyContact.find({
      user: user._id,
    });

    if (!contacts.length) {
      throw ApiError.badRequest("No emergency contacts found");
    }

    const latestLocation = sos.locations?.length
      ? sos.locations[sos.locations.length - 1]
      : null;

    const locationLink = latestLocation
      ? `https://maps.google.com/?q=${latestLocation.lat},${latestLocation.lng}`
      : sos.locationLink;

    // send alert to ALL contacts again
    for (let contact of contacts) {
      await sendSosAlert(contact, user, locationLink, sos._id);
    }

    sos.lastAlertAt = new Date();
    await sos.save();

    res.json(ApiResponse.success(null, "Alert sent again"));
  })
);

module.exports = router;
