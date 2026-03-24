const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { auth } = require("../middleware/auth");
const { authorize, requireVerifiedEmail, isAdmin } = require("../middleware/authorize");
const { ROLES } = require("../constants/roles");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../utils/sendEmail");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");

const router = express.Router();

/**
 * Generate JWT token for authentication
 * @param {string} id - User ID
 * @returns {string} JWT token
 */
const generateAuthToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

/**
 * Generate JWT token for email verification
 * @param {string} id - User ID
 * @returns {string} JWT token
 */
const generateVerificationToken = (id) => {
  const expiresIn = parseInt(process.env.EMAIL_VERIFICATION_EXPIRES, 10) || 1440; // 24 hours in minutes
  return jwt.sign({ id, purpose: "email_verification" }, process.env.JWT_SECRET, {
    expiresIn: `${expiresIn}m`,
  });
};

/**
 * Generate JWT token for password reset
 * @param {string} id - User ID
 * @returns {string} JWT token
 */
const generatePasswordResetToken = (id) => {
  const expiresIn = parseInt(process.env.PASSWORD_RESET_EXPIRES, 10) || 15; // 15 minutes
  return jwt.sign({ id, purpose: "password_reset" }, process.env.JWT_SECRET, {
    expiresIn: `${expiresIn}m`,
  });
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user and send verification email
 * @access  Public
 */
router.post(
  "/register",
  catchAsync(async (req, res) => {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      throw ApiError.badRequest("Please provide name, email, and password.");
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw ApiError.conflict("An account with this email already exists.");
    }

    // Create new user
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: ROLES.USER,
    });

    // Generate email verification token
    const verificationToken = generateVerificationToken(user._id);
    user.emailVerificationToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");
    user.emailVerificationExpires = new Date(
      Date.now() + (parseInt(process.env.EMAIL_VERIFICATION_EXPIRES, 10) || 1440) * 60 * 1000
    );

    // Save user
    await user.save();

    // Send verification email
    const verificationUrl = `${process.env.BASE_URL}/api/auth/verify-email/${verificationToken}`;
    try {
      await sendVerificationEmail(user.email, user.name, verificationUrl);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError.message);
      // Don't fail registration if email fails - user can request resend
    }

    // Generate auth token
    const authToken = generateAuthToken(user._id);

    ApiResponse.created(res, "Registration successful. Please check your email to verify your account.", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      token: authToken,
    });
  })
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT token
 * @access  Public
 */
router.post(
  "/login",
  catchAsync(async (req, res) => {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      throw ApiError.badRequest("Please provide email and password.");
    }

    // Find user by email (include password for comparison)
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      throw ApiError.unauthorized("Invalid email or password.");
    }

    // Compare passwords
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      throw ApiError.unauthorized("Invalid email or password.");
    }

    // Generate auth token
    const token = generateAuthToken(user._id);

    const message = user.isEmailVerified
      ? "Login successful."
      : "Login successful. Please verify your email for full access.";

    ApiResponse.ok(res, message, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      token,
    });
  })
);

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify user's email address
 * @access  Public
 */
router.get(
  "/verify-email/:token",
  catchAsync(async (req, res) => {
    const { token } = req.params;

    // Verify the JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      throw ApiError.badRequest("Invalid or expired verification link.");
    }

    // Check if it's a verification token
    if (decoded.purpose !== "email_verification") {
      throw ApiError.badRequest("Invalid verification link.");
    }

    // Hash the token and find user
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      _id: decoded.id,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      throw ApiError.badRequest("Invalid or expired verification link.");
    }

    // Check if already verified
    if (user.isEmailVerified) {
      throw ApiError.badRequest("Email is already verified.");
    }

    // Verify email
    user.clearEmailVerification();
    await user.save();

    ApiResponse.ok(res, "Email verified successfully. You now have full access to all features.");
  })
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Private
 */
router.post(
  "/resend-verification",
  auth,
  catchAsync(async (req, res) => {
    const user = await User.findById(req.user._id).select(
      "+emailVerificationToken +emailVerificationExpires"
    );

    if (!user) {
      throw ApiError.notFound("User not found.");
    }

    if (user.isEmailVerified) {
      throw ApiError.badRequest("Email is already verified.");
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken(user._id);
    user.emailVerificationToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");
    user.emailVerificationExpires = new Date(
      Date.now() + (parseInt(process.env.EMAIL_VERIFICATION_EXPIRES, 10) || 1440) * 60 * 1000
    );

    await user.save();

    // Send verification email
    const verificationUrl = `${process.env.BASE_URL}/api/auth/verify-email/${verificationToken}`;
    await sendVerificationEmail(user.email, user.name, verificationUrl);

    ApiResponse.ok(res, "Verification email sent. Please check your inbox.");
  })
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post(
  "/forgot-password",
  catchAsync(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw ApiError.badRequest("Please provide your email address.");
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+passwordResetToken +passwordResetExpires +passwordResetUsed"
    );

    // Always return success message to prevent email enumeration
    if (!user) {
      return ApiResponse.ok(
        res,
        "If an account with that email exists, a password reset link has been sent."
      );
    }

    // Generate password reset token
    const resetToken = generatePasswordResetToken(user._id);
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpires = new Date(
      Date.now() + (parseInt(process.env.PASSWORD_RESET_EXPIRES, 10) || 15) * 60 * 1000
    );
    user.passwordResetUsed = false;

    await user.save();

    // Send password reset email
    const resetUrl = `${process.env.BASE_URL}/api/auth/reset-password/${resetToken}`;
    try {
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    } catch (emailError) {
      // Clear reset token if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.passwordResetUsed = undefined;
      await user.save();

      throw ApiError.internal("Could not send password reset email. Please try again later.");
    }

    ApiResponse.ok(
      res,
      "If an account with that email exists, a password reset link has been sent."
    );
  })
);

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password using token (one-time use)
 * @access  Public
 */
router.post(
  "/reset-password/:token",
  catchAsync(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      throw ApiError.badRequest("Please provide a new password.");
    }

    if (password.length < 6) {
      throw ApiError.badRequest("Password must be at least 6 characters long.");
    }

    // Verify the JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      throw ApiError.badRequest("Invalid or expired reset link.");
    }

    // Check if it's a password reset token
    if (decoded.purpose !== "password_reset") {
      throw ApiError.badRequest("Invalid reset link.");
    }

    // Hash the token and find user
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      _id: decoded.id,
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+passwordResetToken +passwordResetExpires +passwordResetUsed +password");

    if (!user) {
      throw ApiError.badRequest("Invalid or expired reset link.");
    }

    // Check if token has already been used (one-time use)
    if (user.passwordResetUsed) {
      throw ApiError.badRequest("This reset link has already been used. Please request a new one.");
    }

    // Update password and clear reset fields
    user.password = password;
    user.clearPasswordReset();
    await user.save();

    ApiResponse.ok(res, "Password reset successful. You can now login with your new password.");
  })
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged-in user's profile
 * @access  Private
 */
router.get(
  "/me",
  auth,
  catchAsync(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
      throw ApiError.notFound("User not found.");
    }

    ApiResponse.ok(res, "Profile fetched successfully.", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        emergencyContacts: user.emergencyContacts,
        createdAt: user.createdAt,
      },
    });
  })
);

/**
 * @route   GET /api/auth/admin/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get(
  "/admin/users",
  auth,
  authorize(ROLES.ADMIN),
  catchAsync(async (req, res) => {
    const users = await User.find().select("-__v");

    ApiResponse.ok(res, "Users fetched successfully.", {
      count: users.length,
      users,
    });
  })
);

/**
 * @route   PATCH /api/auth/admin/users/:id/role
 * @desc    Update user role (admin only)
 * @access  Private/Admin
 */
router.patch(
  "/admin/users/:id/role",
  auth,
  authorize(ROLES.ADMIN),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || ![ROLES.USER, ROLES.ADMIN].includes(role)) {
      throw ApiError.badRequest("Invalid role. Must be 'user' or 'admin'.");
    }

    // Prevent admin from changing their own role
    if (id === req.user._id.toString()) {
      throw ApiError.badRequest("You cannot change your own role.");
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw ApiError.notFound("User not found.");
    }

    ApiResponse.ok(res, `User role updated to ${role}.`, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  })
);

module.exports = router;
