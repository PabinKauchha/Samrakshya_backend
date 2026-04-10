class ApiResponse {
  static success(data = {}, message = "Success") {
  return {
    success: true,
    message: typeof message === "string" ? message : message?.message || "Success",
    data,
  };
}

  static created(res, message, data = {}) {
    return res.status(201).json({
      success: true,
      message,
      data,
    });
  }

  static ok(res, message, data = {}) {
    return res.status(200).json({
      success: true,
      message,
      data,
    });
  }

  static noContent(res) {
    return res.status(204).send();
  }
}

module.exports = ApiResponse;