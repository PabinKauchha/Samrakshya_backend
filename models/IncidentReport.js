const mongoose = require("mongoose");
const crypto = require("crypto");
const { INCIDENT_TYPES_ARRAY } = require("../constants/incidentTypes");

/**
 * Notification status enum for tracking SMS delivery
 */
const NOTIFICATION_STATUS = Object.freeze({
  PENDING: "pending",
  SENT: "sent",
  DELIVERED: "delivered",
  FAILED: "failed",
});

const NOTIFICATION_STATUS_ARRAY = Object.freeze(
  Object.values(NOTIFICATION_STATUS)
);

/**
 * Schema for tracking notifications sent to emergency contacts
 */
const NotifiedContactSchema = new mongoose.Schema(
  {
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmergencyContact",
      required: true,
    },
    // Snapshot of contact details at notification time
    phone: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    notifiedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: {
        values: NOTIFICATION_STATUS_ARRAY,
        message: "Invalid notification status",
      },
      default: NOTIFICATION_STATUS.PENDING,
    },
    failureReason: {
      type: String,
    },
  },
  { _id: false }
);

/**
 * Location schema for incident geolocation
 */
const LocationSchema = new mongoose.Schema(
  {
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
    address: {
      type: String,
      maxlength: [500, "Address must be at most 500 characters"],
    },
  },
  { _id: false }
);

const IncidentReportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title must be at most 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [2000, "Description must be at most 2000 characters"],
    },
    type: {
      type: String,
      required: [true, "Incident type is required"],
      enum: {
        values: INCIDENT_TYPES_ARRAY,
        message: "Invalid incident type",
      },
    },
    customType: {
      type: String,
      trim: true,
      maxlength: [100, "Custom type must be at most 100 characters"],
    },
    location: {
      type: LocationSchema,
      required: [true, "Location is required"],
    },
    occurredAt: {
      type: Date,
      required: [true, "Incident occurrence time is required"],
    },
    notifiedContacts: [NotifiedContactSchema],
    viewToken: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple null values
    },
  },
  {
    timestamps: true,
  }
);

// Index for user's incident history sorted by date
IncidentReportSchema.index({ user: 1, createdAt: -1 });

// Index for public view token lookup
IncidentReportSchema.index({ viewToken: 1 });

/**
 * Pre-save middleware to generate view token
 */
IncidentReportSchema.pre("save", function (next) {
  if (this.isNew && !this.viewToken) {
    this.viewToken = crypto.randomBytes(32).toString("hex");
  }
  next();
});

/**
 * Virtual to get formatted incident type display
 */
IncidentReportSchema.virtual("displayType").get(function () {
  if (this.type === "other" && this.customType) {
    return this.customType;
  }
  return this.type.replace(/_/g, " ");
});

// Ensure virtuals are included in JSON output
IncidentReportSchema.set("toJSON", { virtuals: true });
IncidentReportSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("IncidentReport", IncidentReportSchema);
