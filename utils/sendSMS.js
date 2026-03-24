/**
 * SMS Utility - Stub for Development
 * Ready for Twilio integration in production
 *
 * To enable Twilio in production:
 * 1. npm install twilio
 * 2. Set TWILIO_ENABLED=true in environment
 * 3. Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */

/**
 * Send SMS to a single phone number
 * @param {string} to - Phone number in E.164 format
 * @param {string} message - SMS message content
 * @returns {Promise<object>} - Result with success status and details
 */
const sendSMS = async (to, message) => {
  // Production: Use Twilio
  if (
    process.env.NODE_ENV === "production" &&
    process.env.TWILIO_ENABLED === "true"
  ) {
    try {
      // Uncomment when Twilio is installed:
      // const twilio = require("twilio");
      // const client = twilio(
      //   process.env.TWILIO_ACCOUNT_SID,
      //   process.env.TWILIO_AUTH_TOKEN
      // );
      //
      // const result = await client.messages.create({
      //   body: message,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   to: to,
      // });
      //
      // return {
      //   success: true,
      //   provider: "twilio",
      //   sid: result.sid,
      //   to,
      //   timestamp: new Date().toISOString(),
      // };

      throw new Error(
        "Twilio is not yet configured. Install twilio package and uncomment the code."
      );
    } catch (error) {
      console.error("[SMS ERROR] Twilio failed:", error.message);
      throw error;
    }
  }

  // Development: Log to console (stub)
  console.log("\n" + "═".repeat(60));
  console.log("[SMS STUB] Development Mode - SMS Not Actually Sent");
  console.log("═".repeat(60));
  console.log(`To: ${to}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("-".repeat(60));
  console.log("Message:");
  console.log(message);
  console.log("═".repeat(60) + "\n");

  return {
    success: true,
    provider: "stub",
    to,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Send incident alert SMS to multiple emergency contacts
 * @param {object} incident - Incident report document
 * @param {object} user - User who reported the incident
 * @param {Array} contacts - Array of emergency contact documents
 * @returns {Promise<Array>} - Array of notification results for each contact
 */
const sendIncidentAlert = async (incident, user, contacts) => {
  const results = [];

  // Get formatted incident type
  const incidentType =
    incident.type === "other"
      ? incident.customType
      : incident.type.replace(/_/g, " ");

  // Format location for display
  const locationDisplay =
    incident.location.address ||
    `${incident.location.latitude}, ${incident.location.longitude}`;

  for (const contact of contacts) {
    const message = `EMERGENCY ALERT from ${user.name}!

Type: ${incidentType.toUpperCase()}
Title: ${incident.title}
Time: ${new Date(incident.occurredAt).toLocaleString()}
Location: ${locationDisplay}

View details: ${process.env.BASE_URL}/api/incidents/view/${incident.viewToken}

This is an automated alert from Samrakshya Safety App.`;

    try {
      await sendSMS(contact.phone, message);
      results.push({
        contact: contact._id,
        phone: contact.phone,
        name: contact.name,
        status: "sent",
        notifiedAt: new Date(),
      });
    } catch (error) {
      console.error(
        `[SMS ERROR] Failed to send to ${contact.phone}:`,
        error.message
      );
      results.push({
        contact: contact._id,
        phone: contact.phone,
        name: contact.name,
        status: "failed",
        failureReason: error.message,
        notifiedAt: new Date(),
      });
    }
  }

  return results;
};

module.exports = { sendSMS, sendIncidentAlert };
