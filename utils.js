// Shared helper functions for DRY compliance

/**
 * Generate JSON envelope for movie requirement responses
 * Returns headers, query parameters, and UNIQUE_KEY environment variable
 *
 * SECURITY NOTE: This function intentionally includes req.headers (which may contain
 * Authorization tokens) for assignment testing purposes. In production, this should
 * be filtered to exclude sensitive headers.
 *
 * @param {Object} req - Express request object
 * @returns {Object} Envelope with headers, query, and env fields
 */
function getJSONObjectForMovieRequirement(req) {
  return {
    headers: req.headers,
    query: req.query,
    env: process.env.UNIQUE_KEY
  };
}

module.exports = {
  getJSONObjectForMovieRequirement
};
