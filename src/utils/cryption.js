'use strict';

const Crypto = require('crypto');
const bcrypt = require('bcryptjs');
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

const Algorithm = Object.freeze({
  AES128: 'aes128',
  AES128CBC: 'aes-128-cbc',
  AES192: 'aes192',
  AES192CBC: 'aes-192-cbc',
  AES256: 'aes256',
  AES256CBC: 'aes-256-cbc'
});

class Cryption {
  static generateRandomKey() {
    return Crypto.randomBytes(IV_LENGTH).toString('hex');
  }

  static encrypt(data, secret, salt, algorithm) {
    return new Promise((resolve, reject) => {
      if (!salt) {
        salt = Buffer.from(secret, 'hex');
      }
      if (!data) {
        return reject(new Error('No data found'));
      }
      if (!secret) {
        return reject(new Error('secret required.'));
      }
      const key = Crypto.scryptSync(secret, salt, KEY_LENGTH);
      const algo = !algorithm ? Algorithm.AES256CBC : algorithm;
      const iv = Buffer.from(Cryption.generateRandomKey(), 'hex');
      const cipher = Crypto.createCipheriv(algo, key, iv);
      let encrypted = cipher.update(data);

      encrypted = Buffer.concat([encrypted, cipher.final()]);
      return resolve(iv.toString('hex') + ':' + encrypted.toString('hex'));
    });
  }

  static decrypt(data, secret, salt, algorithm) {
    return new Promise((resolve, reject) => {
      if (!salt) {
        salt = Buffer.from(secret, 'hex');
      }
      if (!data) {
        return reject(new Error('No data found'));
      }
      if (!secret) {
        return reject(new Error('secret required.'));
      }
      const algo = !algorithm ? Algorithm.AES256CBC : algorithm;
      const split = data.split(':');
      const iv = Buffer.from(split.shift(), 'hex');
      const encrypted = Buffer.from(split.join(':'), 'hex');
      const key = Crypto.scryptSync(secret, salt, KEY_LENGTH);
      const decipher = Crypto.createDecipheriv(algo, key, iv);
      let decrypted = decipher.update(encrypted);

      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return resolve(decrypted.toString());
    });
  }

  static hash(value) {
    return bcrypt.hashSync(value, bcrypt.genSaltSync(IV_LENGTH));
  }

  // checking if password is valid
  static validate(value, secret) {
    return bcrypt.compareSync(value, secret);
  }
}

module.exports = {
  Cryption: Cryption,
  Algorithm: Algorithm
};
