const { StatusCodes } = require('http-status-codes');

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  const customError = {
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    message: err.message || 'Something went wrong',
  };

  // Mongoose duplicate key error
  if (err.code === 11000) {
    customError.statusCode = StatusCodes.BAD_REQUEST;
    customError.message = `Duplicate value: ${Object.keys(err.keyValue)}`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    customError.statusCode = StatusCodes.BAD_REQUEST;
    customError.message = Object.values(err.errors).map(e => e.message).join(', ');
  }

  // Mongoose cast error (invalid ID)
  if (err.name === 'CastError') {
    customError.statusCode = StatusCodes.NOT_FOUND;
    customError.message = `Resource not found with id: ${err.value}`;
  }

  res.status(customError.statusCode).json({
    success: false,
    error: customError.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;