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
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password.",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
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

    res.status(201).json({
      success: true,
      message: "Registration successful. Please check your email to verify your account.",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        token: authToken,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(". "),
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error during registration.",
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT token
 * @access  Public
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password.",
      });
    }

    // Find user by email (include password for comparison)
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Compare passwords
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Generate auth token
    const token = generateAuthToken(user._id);

    res.status(200).json({
      success: true,
      message: user.isEmailVerified
        ? "Login successful."
        : "Login successful. Please verify your email for full access.",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login.",
    });
  }
});

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify user's email address
 * @access  Public
 */
router.get("/verify-email/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Verify the JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification link.",
      });
    }

    // Check if it's a verification token
    if (decoded.purpose !== "email_verification") {
      return res.status(400).json({
        success: false,
        message: "Invalid verification link.",
      });
    }

    // Hash the token and find user
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      _id: decoded.id,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification link.",
      });
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified.",
      });
    }

    // Verify email
    user.clearEmailVerification();
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully. You now have full access to all features.",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during email verification.",
    });
  }
});

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Private
 */
router.post("/resend-verification", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "+emailVerificationToken +emailVerificationExpires"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified.",
      });
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

    res.status(200).json({
      success: true,
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not send verification email.",
    });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide your email address.",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+passwordResetToken +passwordResetExpires +passwordResetUsed"
    );

    // Always return success message to prevent email enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent.",
      });
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

      return res.status(500).json({
        success: false,
        message: "Could not send password reset email. Please try again later.",
      });
    }

    res.status(200).json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not process password reset request.",
    });
  }
});

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password using token (one-time use)
 * @access  Public
 */
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Please provide a new password.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    // Verify the JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link.",
      });
    }

    // Check if it's a password reset token
    if (decoded.purpose !== "password_reset") {
      return res.status(400).json({
        success: false,
        message: "Invalid reset link.",
      });
    }

    // Hash the token and find user
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      _id: decoded.id,
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+passwordResetToken +passwordResetExpires +passwordResetUsed +password");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link.",
      });
    }

    // Check if token has already been used (one-time use)
    if (user.passwordResetUsed) {
      return res.status(400).json({
        success: false,
        message: "This reset link has already been used. Please request a new one.",
      });
    }

    // Update password and clear reset fields
    user.password = password;
    user.clearPasswordReset();
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successful. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password reset.",
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged-in user's profile
 * @access  Private
 */
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          emergencyContacts: user.emergencyContacts,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching profile.",
    });
  }
});

/**
 * @route   GET /api/auth/admin/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get("/admin/users", auth, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const users = await User.find().select("-__v");

    res.status(200).json({
      success: true,
      count: users.length,
      data: {
        users,
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching users.",
    });
  }
});

/**
 * @route   PATCH /api/auth/admin/users/:id/role
 * @desc    Update user role (admin only)
 * @access  Private/Admin
 */
router.patch("/admin/users/:id/role", auth, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || ![ROLES.USER, ROLES.ADMIN].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be 'user' or 'admin'.",
      });
    }

    // Prevent admin from changing their own role
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own role.",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: `User role updated to ${role}.`,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating user role.",
    });
  }
});

module.exports = router;
