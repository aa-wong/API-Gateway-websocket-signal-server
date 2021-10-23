'use strict';

const mongoose = require('mongoose');
const {
  ErrorTemplate,
  ResponseConstructor
} = require('./utils');
const {
  errorResponse,
  wrongEndpoint
} = ErrorTemplate;
const { DATABASE_URL } = process.env;
const {
  Connect,
  Default,
  Disconnect,
  Message
} = require('./websockets');
mongoose
  .connect(DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('connection successful'))
  .catch((err) => console.error(err))

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

mongoose.connection.on('error', console.error.bind(console, 'connection error:'));

exports.handler = async event => {
  const { routeKey } = event.requestContext;

  switch (routeKey) {
    case "$connect":
      return Connect(event);
      break;
    case "$disconnect":
      return Disconnect(event);
      break;
    case "message":
      return Message(event);
      break;
    default:
      return Default(event);
  }
};
