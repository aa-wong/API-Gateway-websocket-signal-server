'use strict';

const ResponseConstructor = require('./response-constructor');

const errorResponse = (error) => {
  console.log(error);
  const status = error.status !== undefined ? error.status : 500;

  return ResponseConstructor(status, error.message);
}

const accessDenied = () => {
  const e = new Error('Permission denied. Credentials do not have access rights to this API.');

  e.status = 403;
  return errorResponse(e);
}

module.exports = {
  accessDenied,
  errorResponse
}
