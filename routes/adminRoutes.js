const express = require("express");
const router = express.Router();

const SOS = require("../models/sos");
const User = require("../models/User");
// const Incident = require("../models/Incident"); // (uncomment if you have it)

const { auth } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");

console.log("✅ Admin routes loaded");

// 🔐 Admin check middleware
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return next(ApiError.forbidden("Access denied. Admin only."));
  }
  next();
};

// ============================
// 📊 GET STATS
// ============================
router.get(
  "/stats",
  auth,
  adminOnly,
  catchAsync(async (req, res) => {
    console.log("🔥 /api/admin/stats HIT");

    const totalUsers = await User.countDocuments();
    const totalSOS = await SOS.countDocuments();
    const activeSOS = await SOS.countDocuments({ status: "active" });

    // If you have Incident model, use it:
    // const totalIncidents = await Incident.countDocuments();

    return res.json(
      ApiResponse.success(
        {
          totalUsers,
          totalSOS,
          activeSOS,
          totalIncidents: totalSOS, // replace later with real Incident count
        },
        "Stats fetched"
      )
    );
  })
);

// ============================
// 🚨 GET ACTIVE SOS
// ============================
router.get(
  "/active-sos",
  auth,
  adminOnly,
  catchAsync(async (req, res) => {
    console.log("🔥 /api/admin/active-sos HIT");

    const sosList = await SOS.find({ status: "active" })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.json(
      ApiResponse.success(sosList, "Active SOS fetched")
    );
  })
);

module.exports = router;