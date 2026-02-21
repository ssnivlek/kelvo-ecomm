/**
 * API Gateway response helpers with CORS headers.
 * @module shared/responses
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

/**
 * Returns a successful API Gateway response.
 * @param {object} data - Response body data
 * @param {number} [statusCode=200] - HTTP status code
 * @returns {object} API Gateway response object
 */
function success(data, statusCode = 200) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

/**
 * Returns an error API Gateway response.
 * @param {string} message - Error message
 * @param {number} [statusCode=500] - HTTP status code
 * @returns {object} API Gateway response object
 */
function error(message, statusCode = 500) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Returns a 201 Created API Gateway response.
 * @param {object} data - Response body data
 * @returns {object} API Gateway response object
 */
function created(data) {
  return success(data, 201);
}

module.exports = {
  success,
  error,
  created,
  CORS_HEADERS,
};
