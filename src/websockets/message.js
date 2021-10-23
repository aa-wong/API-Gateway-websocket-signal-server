'use strict';

const { DYNAMO_TABLE_NAME } = process.env
const {
  Dynamo,
  ResponseConstructor,
  ErrorTemplate
} = require('../utils');
const {
  accessDenied,
  errorResponse
} = ErrorTemplate;
const { send } = require('./websocket-manager');

module.exports = async event => {
  console.log('event', event);

  try {
    const { body } = event;
    const data = await JSON.parse(body.data);

    await send(event, data.connectionId, data.message);

    return ResponseConstructor(200, 'Got a message');
  } catch (e) {
    return errorResponse(e);
  }
};
