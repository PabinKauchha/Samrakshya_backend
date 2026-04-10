// Load environment variables first
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// 🔥 IMPORT ROUTES
const authRoutes = require("./routes/authRoutes");
const sosRoutes = require("./routes/sosroutes");
const emergencyContactRoutes = require("./routes/emergencyContactRoutes");
const incidentReportRoutes = require("./routes/incidentReportRoutes");
const adminRoutes = require("./routes/adminRoutes"); // ✅ IMPORTANT

// 🔥 ERROR HANDLING
const ApiError = require("./utils/ApiError");
const errorConverter = require("./middleware/errorConverter");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// ================= DB =================
connectDB();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// 🔍 DEBUG LOGGER (keep this)
app.use((req, res, next) => {
  console.log("\n---------------------------");
  console.log("METHOD:", req.method);
  console.log("URL:", req.url);
  console.log("BODY:", req.body);
  next();
});

// ================= ROUTES =================

// 🔥 TEST ADMIN ROUTE (VERY IMPORTANT DEBUG)
app.get("/api/admin/test", (req, res) => {
  res.send("✅ Admin route working");
});

// 🔥 REGISTER ROUTES
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/emergency-contacts", emergencyContactRoutes);
app.use("/api/incidents", incidentReportRoutes);

// Static files (for your tracking HTML)
app.use(express.static("public"));

// ================= HEALTH =================
app.get("/", (req, res) => {
  res.send("Samrakshya Backend Running");
});

// ================= 404 =================
app.use((req, res, next) => {
  next(ApiError.notFound("Route not found"));
});

app.get("/api/admin/test", (req, res) => {
  res.send("Admin route working");
});

// ================= ERROR =================
app.use(errorConverter);
app.use(errorHandler);

// ================= START =================
const PORT = process.env.PORT || 4321;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});