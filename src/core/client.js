'use strict';

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const {
  cryption,
  GenerateRecordHistory
} = require('../utils');
const { Cryption } = cryption;
const {
  SECRET,
  API_SERVER,
  AUTH_SERVER
} = process.env;
const Account = require('./account');

/**
 * Access Level Enums
 * @type {[type]}
 */
const AccessPermission = Object.freeze({
  READWRITE: 'READWRITE',
  READONLY: 'READONLY',
  _: {
    code: {
      READWRITE: 0,
      READONLY: 1,
    },
    access: {
      0: 'READWRITE',
      1: 'READONLY',
    }
  }
});

const Schema = mongoose.Schema;

// define the schema for our user model
const schema = new Schema({
  name: {
    type: String,
    required: true
  },
  account: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  secret: {
    type: String,
    required: true
  },
  access_permission: {
    type : Number,
    default: 1
  },
  enabled: {
    type : Boolean,
    default: true
  },
  refresh_key: {
    type: String,
    required: false
  },
  external_id: {
    type: String,
    index: true,
    required: false,
  },
  extensors: {
    type: Object,
    required: false
  },
  record_history: {
    created_at: Date,
    created_by: String,
    created_by_type: String,
    updated_at: Date,
    updated_by: String,
    updated_by_type: String
  }
});

// methods ======================
schema.methods.getAccessPermission = function() {
  return AccessPermission._.access[this.access_permission];
}

schema.methods.isEnabled = function() {
  return this.enabled;
}

schema.methods.export = function(account) {
  return new Promise(async (resolve, reject) => {
    try {
      const decrypt = await this.decryptSecret(account);
      const data = Object.assign({}, this.toJSON());

      delete data.__v;
      data.access_permission = this.getAccessPermission();
      data.id = data._id;
      data.secret = decrypt;
      delete data._id;
      delete data.refresh_key;

      return resolve(data);
    } catch (e) {
      return reject(e);
    }
  });
}

schema.methods.decryptSecret = function(account) {
  return new Promise(async (resolve, reject) => {
    try {
      const key = await account.decryptedKey();
      const secret = await Cryption.decrypt(this.secret, key);

      return resolve(secret)
    } catch (e) {
      return reject(e);
    }
  });
}

schema.methods.validateSecret = function(secret, account) {
  return new Promise(async (resolve, reject) => {
    try {
      const accountSecret = await this.decryptSecret(account);

      return resolve(secret === accountSecret);
    } catch (e) {
      return reject(e);
    }
  });
}

schema.methods.token = function(acc) {
  return new Promise(async (resolve, reject) => {
    const data = {
      account: acc._id,
      client: this._id
    };
    const expiryTime = 60 * 60 * 24 // expires in 24 hours
  	const token = jwt.sign(data, SECRET, { expiresIn: expiryTime });
    try {
      const refresh = await this.refreshToken(acc);

    	return resolve({
        access_token: token,
        refresh_token: refresh,
        expires_in: expiryTime,
        token_type: 'Bearer',
        api_server: `${API_SERVER}/v1`,
        auth_server: `${AUTH_SERVER}/v1`
    	});
    } catch (e) {
      return reject(e);
    }
  });
}

schema.methods.update = function(obj, res) {
  return new Promise(async (resolve, reject) => {
    if (obj.name) this.name = obj.name;
    if (obj.enabled !== undefined) this.enabled = Boolean(obj.enabled);
    if (obj.access_permission) {
      const level = AccessPermission._.code[obj.access_permission.toUpperCase()];
      if (level === null) {
        const e = new Error('Invalid access_permission');

        e.status = 406;
        return reject(e);
      }
      this.access_permission = level
    }
    if (obj.external_id) this.external_id = obj.external_id;
    if (obj.extensors) this.extensors = obj.extensors;
    if (res) this.record_history = GenerateRecordHistory(this.record_history, res);
    try {
      await this.save();
      return resolve(this);
    } catch (e) {
      e.status = 500;
      return reject(e);
    }
  });
}

schema.methods.validateRefreshKey = function(refreshKey, account) {
  return new Promise(async (resolve, reject) => {
    try {
      const secretKey = await account.decryptedKey();
      const validationKey = await Cryption.decrypt(this.refresh_key, secretKey);

      return resolve(validationKey === refreshKey);
    } catch (e) {
      return reject(e);
    }
  });
}

schema.methods.refreshToken = function(account) {
  return new Promise(async (resolve, reject) => {
    try {
      const refreshKey = Cryption.generateRandomKey();
      const key = await account.decryptedKey();

      this.refresh_key = await Cryption.encrypt(refreshKey, key);
      await this.save();

      const data = {
        refresh_key: refreshKey,
        account: this.account,
        client: this._id
      };
      const refresh = jwt.sign(data, process.env.SECRET);

      return resolve(refresh);
    } catch (e) {
      return reject(e);
    }
  });
}

// statics ======================
schema.statics.create = function(obj, account, res) {
  return new Promise(async (resolve, reject) => {
    try {
      const key = await account.decryptedKey();
      let client = new this;

      client.account = account._id;
      client.secret = await Cryption.encrypt(Cryption.generateRandomKey(), key);
      client = await client.update(obj, res);
      return resolve(client);
    } catch (e) {
      return reject(e);
    }
  });
}

schema.statics.getAll = function(account) {
  return new Promise(async (resolve, reject) => {
    try {
      const clients = await this.find({});
      const data = await Promise.all(clients.map(async c => {
        try {
          const acc = await Account.findById(c.account);
          return c.export(acc);
        } catch (e) {
          return reject(e);
        }
      }));
      return resolve(data);
    } catch (e) {
      return reject(e);
    }
  });
}

schema.statics.query = function(query = {}) {
 return new Promise(async (resolve, reject) => {
   let {
     offset,
     limit,
     all,
     show_disabled,
     enabled
   } = query;
   [
     'offset',
     'limit',
     'all',
     'show_disabled'
   ].forEach(q => delete query[q]);

   if (!show_disabled && enabled === undefined) query.enabled = true;
   try {
     if (!all) {
       offset = !offset ? 0 : parseInt(offset);
       limit = !limit ? 10 : parseInt(limit);

       const total = await this.countDocuments(query);
       const results = await this.find(query, {}, {
         skip: offset,
         limit,
         sort: {'record_history.created_at': -1}
       });

       const page = offset / limit;
       return resolve({
         results,
         paging: {
           offset,
           limit,
           total,
           page: (offset / limit) + 1,
           total_pages: Math.ceil(total / limit)
         }
       });
     }
     const results = await this.find(query, {}, {sort: {'record_history.created_at': -1}});

     return resolve({ results });
   } catch (e) {
     return reject(e);
   }
 });
}

schema.statics.getAllByAccount = function(account) {
  return new Promise(async (resolve, reject) => {
    try {
      const clients = await this.find({ 'account': account.id });
      const data = await Promise.all(clients.map(cl => cl.export(account)));

      return resolve(data);
    } catch (e) {
      return reject(e);
    }
  });
}

schema.statics.getByName = function(name, account) {
  return new Promise(async (resolve, reject) => {
    if (name && typeof name === 'string' && account) {
      try {
        const client = await this.find({
          'account': account._id,
          'name': name
        });

        return resolve(client);
      } catch (e) {
        return reject(e);
      }
    }
    const err = new Error('Requires valid account and name type of string');

    err.status = 401;
    return reject(err);
  });
}

/**
 * Enable By ID
 * @param  {[type]} id [description]
 * @return {[type]}    [description]
 */
schema.statics.enableById = function(id, res) {
  return new Promise(async (resolve, reject) => {
    if (id && id.constructor === String) {
      try {
        let client = await this.findById(id);

        client = await client.update({enabled: true}, res);
        return resolve(client);
      } catch (e) {
        return reject(e);
      }
    }
    const e = new Error('id is invalid');

    e.status = 406
    return reject(e);
  });
}

/**
 * Disable By ID
 * @param  {[type]} id [description]
 * @return {[type]}    [description]
 */
schema.statics.disableById = function(id, res) {
  return new Promise(async (resolve, reject) => {
    if (id && id.constructor === String) {
      try {
        let client = await this.findById(id);

        client = await client.update({enabled: false}, res);
        return resolve(client);
      } catch (e) {
        return reject(e);
      }
    }
    const e = new Error('id is invalid');

    e.status = 406
    return reject(e);
  });
}

schema.statics.isReadOnly = function(client) {
  if (client && client.access_permission !== undefined) {
    return AccessPermission._.access[client.access_permission] === AccessPermission.READONLY;
  }
  return false;
}

schema.statics.isReadWrite = function(client) {
  if (client && client.access_permission !== undefined) {
    return AccessPermission._.access[client.access_permission] === AccessPermission.READWRITE
  }
  return false;
}

let Client;
try {
  Client = mongoose.model('Client');
} catch (error) {
  Client = mongoose.model('Client', schema);
}

Client.on('index', e => {
  if (e) console.error(e.message)
});

module.exports = Client;
