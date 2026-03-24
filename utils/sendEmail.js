const { createTransporter } = require("../config/email");
const { renderEmail } = require("./renderEmail");

/**
 * Send an email using nodemailer
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content (optional)
 * @returns {Promise<Object>} - Nodemailer send result
 */
const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Samrakshya" <${process.env.EMAIL_FROM}>`,
    to,
    subject,
    text,
    html: html || text,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`Email sent: ${info.messageId}`);
  return info;
};

/**
 * Send email verification email using EJS template
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {string} verificationUrl - URL to verify email
 */
const sendVerificationEmail = async (email, name, verificationUrl) => {
  const subject = "Verify Your Email - Samrakshya";

  // Calculate expiry time from environment variable
  const expiresInMinutes =
    parseInt(process.env.EMAIL_VERIFICATION_EXPIRES, 10) || 1440;
  const expiresIn =
    expiresInMinutes >= 60
      ? `${Math.floor(expiresInMinutes / 60)} hour${Math.floor(expiresInMinutes / 60) > 1 ? "s" : ""}`
      : `${expiresInMinutes} minutes`;

  // Render email template
  const { html, text } = await renderEmail("verify-email", {
    title: "Verify Your Email",
    name,
    verificationUrl,
    expiresIn,
  });

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Send password reset email using EJS template
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {string} resetUrl - URL to reset password
 */
const sendPasswordResetEmail = async (email, name, resetUrl) => {
  const subject = "Password Reset Request - Samrakshya";

  // Calculate expiry time from environment variable
  const expiresInMinutes =
    parseInt(process.env.PASSWORD_RESET_EXPIRES, 10) || 15;
  const expiresIn = `${expiresInMinutes} minute${expiresInMinutes > 1 ? "s" : ""}`;

  // Render email template
  const { html, text } = await renderEmail("password-reset", {
    title: "Password Reset",
    name,
    resetUrl,
    expiresIn,
  });

  return sendEmail({ to: email, subject, text, html });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
