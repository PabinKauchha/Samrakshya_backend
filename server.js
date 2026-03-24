// Load environment variables first (must be at the top)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// Import routes
const authRoutes = require("./routes/authRoutes");
const sosRoutes = require("./routes/sosroutes");
const emergencyContactRoutes = require("./routes/emergencyContactRoutes");
const incidentReportRoutes = require("./routes/incidentReportRoutes");

// Import error handling
const ApiError = require("./utils/ApiError");
const errorConverter = require("./middleware/errorConverter");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/emergency-contacts", emergencyContactRoutes);
app.use("/api/incidents", incidentReportRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Samrakshya Backend Running");
});

// 404 handler - convert to ApiError
app.use((req, res, next) => {
  next(ApiError.notFound("Route not found"));
});

// Error handling middleware chain
app.use(errorConverter);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
