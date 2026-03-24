const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES, ROLES_ARRAY } = require("../constants/roles");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password by default in queries
    },
    role: {
      type: String,
      enum: {
        values: ROLES_ARRAY,
        message: "Role must be either user or admin",
      },
      default: ROLES.USER,
    },
    emergencyContacts: [
      {
        name: String,
        phone: String,
      },
    ],

    // Email verification fields
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },

    // Password reset fields
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    passwordResetUsed: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

/**
 * Pre-save middleware to hash password before saving
 * Only runs if password field is modified
 */
UserSchema.pre("save", async function (next) {
  // Only hash password if it's modified (or new)
  if (!this.isModified("password")) {
    return next();
  }

  try {
    // Generate salt with 10 rounds
    const salt = await bcrypt.genSalt(10);
    // Hash the password
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Instance method to compare entered password with hashed password
 * @param {string} enteredPassword - Plain text password to compare
 * @returns {Promise<boolean>} - True if passwords match
 */
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Instance method to clear password reset fields after successful reset
 */
UserSchema.methods.clearPasswordReset = function () {
  this.passwordResetToken = undefined;
  this.passwordResetExpires = undefined;
  this.passwordResetUsed = true;
};

/**
 * Instance method to clear email verification fields after verification
 */
UserSchema.methods.clearEmailVerification = function () {
  this.emailVerificationToken = undefined;
  this.emailVerificationExpires = undefined;
  this.isEmailVerified = true;
};

module.exports = mongoose.model("User", UserSchema);
