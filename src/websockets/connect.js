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
const authorize = require('./authorize');
const { closeSelf } = require('./websocket-manager');

module.exports = async event => {
  const { connectionId } = event.requestContext;

  try {
    const data = await authorize(event);

    await Signal.create({ connectionId }, data);

    return ResponseConstructor(200, 'Connected Successfully');
  } catch (e) {
    closeSelf(event);
    return errorResponse(e);
  }
};
