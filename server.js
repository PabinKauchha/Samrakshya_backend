// Load environment variables first (must be at the top)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// Import routes
const userRoutes = require("./routes/userRoutes");
const sosRoutes = require("./routes/sosroutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sos", sosRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Samrakshya Backend Running");
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
