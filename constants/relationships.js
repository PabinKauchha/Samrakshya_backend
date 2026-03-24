/**
 * Relationship type constants using Object.freeze for immutability
 * Used for categorizing emergency contact relationships
 */
const RELATIONSHIPS = Object.freeze({
  PARENT: "parent",
  SPOUSE: "spouse",
  SIBLING: "sibling",
  CHILD: "child",
  FRIEND: "friend",
  RELATIVE: "relative",
  NEIGHBOR: "neighbor",
  COWORKER: "coworker",
  OTHER: "other",
});

/**
 * Array of all valid relationship types for validation
 */
const RELATIONSHIPS_ARRAY = Object.freeze(Object.values(RELATIONSHIPS));

module.exports = { RELATIONSHIPS, RELATIONSHIPS_ARRAY };
