const nodemailer = require("nodemailer");

/**
 * Create and configure nodemailer transporter for Mailtrap
 * Mailtrap is used for testing emails in development
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Verify email configuration
 * @returns {Promise<boolean>} - True if configuration is valid
 */
const verifyEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log("Email configuration verified successfully");
    return true;
  } catch (error) {
    console.error("Email configuration error:", error.message);
    return false;
  }
};

module.exports = { createTransporter, verifyEmailConfig };
