/**
 * Custom error class for application errors
 * Extends the built-in Error class with additional properties for API error handling
 */
export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  /**
   * Create a new AppError
   * @param message Error message
   * @param statusCode HTTP status code
   */
  constructor(message: string, statusCode: number) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
