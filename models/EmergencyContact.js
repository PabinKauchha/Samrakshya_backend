const mongoose = require("mongoose");
const { RELATIONSHIPS_ARRAY } = require("../constants/relationships");

const EmergencyContactSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
      maxlength: [100, "Name must be at most 100 characters"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [
        /^\+?[1-9]\d{9,14}$/,
        "Please provide a valid phone number",
      ],
    },
    relationship: {
      type: String,
      required: [true, "Relationship is required"],
      enum: {
        values: RELATIONSHIPS_ARRAY,
        message: "Invalid relationship type",
      },
    },
    priority: {
      type: Number,
      default: 1,
      min: [1, "Priority must be at least 1"],
      max: [10, "Priority must be at most 10"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient user contact retrieval sorted by priority
EmergencyContactSchema.index({ user: 1, priority: 1 });

// Compound unique index to prevent duplicate phone numbers per user
EmergencyContactSchema.index({ user: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model("EmergencyContact", EmergencyContactSchema);
