'use strict';

const {
  ResponseConstructor,
  ErrorTemplate
} = require('../utils');
const { Signal } = require('../core');
const {
  accessDenied,
  errorResponse
} = ErrorTemplate;

module.exports = async event => {
  try {
    const { connectionId } = event.requestContext;

    await Signal.deleteByConnectionId(connectionId);
    return ResponseConstructor(200, 'Disconnected');
  } catch (e) {
    return errorResponse(e);
  }
};
