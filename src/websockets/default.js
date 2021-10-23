'use strict';

const { ResponseConstructor } = require('../utils');

module.exports = async event => {
  return ResponseConstructor(200, 'Default');
};
