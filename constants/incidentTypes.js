/**
 * Incident type constants using Object.freeze for immutability
 * Used for categorizing safety incidents
 */
const INCIDENT_TYPES = Object.freeze({
  THEFT: "theft",
  ASSAULT: "assault",
  HARASSMENT: "harassment",
  ACCIDENT: "accident",
  SUSPICIOUS_ACTIVITY: "suspicious_activity",
  NATURAL_DISASTER: "natural_disaster",
  OTHER: "other", // Requires customType field when selected
});

/**
 * Array of all valid incident types for validation
 */
const INCIDENT_TYPES_ARRAY = Object.freeze(Object.values(INCIDENT_TYPES));

module.exports = { INCIDENT_TYPES, INCIDENT_TYPES_ARRAY };
