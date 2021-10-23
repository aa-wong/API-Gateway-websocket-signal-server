'use strict';

const jwt = require('jsonwebtoken');
const {
  Account,
  Client,
  User
} = require('../core');
const { SECRET } = process.env;

const authorize = async event => {
  const { queryStringParameters } = event;
  const token = queryStringParameters['authorization'] || queryStringParameters['Authorization'];

 	if (token && token.constructor === String) {
    try {
      const decoded = await jwt.verify(token, SECRET);

      return getRequestObjects(event, decoded);
    } catch (e) {
      if (e.message === 'jwt expired') {
        e.message = 'Token is expired.';
        e.status = 401;
        return Promise.reject(e);
      }
      return Promise.reject(e);
    }
 	}
  const err = new Error('Missing/invalid Authorization token.');

  err.status = 401;
  return Promise.reject(err);
}

/**
 * Pair Request Defaults
 */
const getRequestObjects = async (event, decoded) => {
  const origin = event.headers.Origin;
  let data = {};
  const e = new Error('Invalid request');
  e.status = 403;

  if (decoded.origin && decoded.origin !== origin) {
    return Promise.reject(e);
  }

  try {
    if (decoded.account) {
      const account = await Account.findById(decoded.account);

      if (!account.enabled) {
        return Promise.reject(e);
      }
      data.requestAccount = account;
    }

    if (decoded.client) {
      const client = await Client.findById(decoded.client);

      if (!client.enabled) {
        return Promise.reject(e);
      }
      data.requestClient = client;
    }

    if (decoded.user) {
      const user = await User.findById(decoded.user);

      if (!user.enabled) {
        return Promise.reject(e);
      }
      data.requestUser = user;
    }
    return Promise.resolve(data);
  } catch (e) {
    return Promise.reject(e);
  }
};

module.exports = authorize;
