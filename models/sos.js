const mongoose = require("mongoose");

/**
 * SOS status enum
 */
const SOS_STATUS = Object.freeze({
  ACTIVE: "active",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
});

const SOS_STATUS_ARRAY = Object.freeze(Object.values(SOS_STATUS));

const sosSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },

    // 🔥 ORIGINAL FIRST LOCATION (keep this)
    latitude: {
      type: Number,
      required: [true, "Latitude is required"],
      min: [-90, "Latitude must be between -90 and 90"],
      max: [90, "Latitude must be between -90 and 90"],
    },
    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
      min: [-180, "Longitude must be between -180 and 180"],
      max: [180, "Longitude must be between -180 and 180"],
    },

    locationLink: {
      type: String,
    },

    status: {
      type: String,
      enum: {
        values: SOS_STATUS_ARRAY,
        message: "Status must be active, confirmed, or cancelled",
      },
      default: SOS_STATUS.ACTIVE,
    },
confirmedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "EmergencyContact",
},

rescuerLocations: [
  {
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmergencyContact",
    },
    lat: Number,
    lng: Number,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
],
    // ==========================================
    // 🔥 NEW: REAL-TIME LOCATION TRACKING
    // ==========================================
    locations: [
      {
        lat: Number,
        lng: Number,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
guardianLocations: [
  {
    lat: Number,
    lng: Number,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
],
    // ==========================================
    // 🔥 NEW: ALERT COOLDOWN
    // ==========================================
    lastAlertAt: {
      type: Date,
    },

    // Track which contacts were notified
    notifiedContacts: [
      {
        contact: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "EmergencyContact",
        },
        name: String,
        phone: String,
        notifiedAt: {
          type: Date,
          default: Date.now,
        },
        status: String,
        failureReason: String,
      },
    ],

    confirmedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for finding active SOS for a user
sosSchema.index({ user: 1, status: 1 });

// Index for history queries
sosSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("SOS", sosSchema);
module.exports.SOS_STATUS = SOS_STATUS;
module.exports.SOS_STATUS_ARRAY = SOS_STATUS_ARRAY;