/**
 * Utility class for consistent API success responses
 */
class ApiResponse {
  /**
   * Send success response
   * @param {import('express').Response} res - Express response object
   * @param {number} statusCode - HTTP status code
   * @param {object} apiResponse - Response details { message: string, data?: any }
   */
  static success(res, statusCode, apiResponse) {
    const response = {
      success: true,
      code: statusCode,
      message: apiResponse.message,
      ...(apiResponse.data !== undefined && { data: apiResponse.data }),
    };

    res.status(statusCode).json(response);
  }

  /**
   * 200 OK response
   * @param {import('express').Response} res
   * @param {string} message
   * @param {any} data
   */
  static ok(res, message, data) {
    return ApiResponse.success(res, 200, { message, data });
  }

  /**
   * 201 Created response
   * @param {import('express').Response} res
   * @param {string} message
   * @param {any} data
   */
  static created(res, message, data) {
    return ApiResponse.success(res, 201, { message, data });
  }

  /**
   * 204 No Content response
   * @param {import('express').Response} res
   */
  static noContent(res) {
    res.status(204).send();
  }
}

module.exports = ApiResponse;
