/**
 * Role constants using Object.freeze for immutability
 * This prevents accidental modification of role values
 */
const ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
});

/**
 * Array of all valid roles for validation
 */
const ROLES_ARRAY = Object.freeze(Object.values(ROLES));

module.exports = { ROLES, ROLES_ARRAY };
