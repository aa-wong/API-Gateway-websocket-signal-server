"use strict";

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const {
  cryption,
  GenerateRecordHistory
} = require('../utils');
const { Cryption } = cryption;

const Account = require('./account');

/**
 * User Level Enums
 * @type {[type]}
 */
const UserPermission = Object.freeze({
  ADMINISTRATOR: 'ADMINISTRATOR',
  USER: 'USER',
  _: {
    code: {
      ADMINISTRATOR: 0,
      USER: 1
    },
    role: {
      0: 'ADMINISTRATOR',
      1: 'USER'
    }
  }
});

const { Schema } = mongoose;

// define the schema for our user model
const schema = new Schema({
  account: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true
  },
  public_address: {
    required: true,
    type: String,
    unique: true
  },
  user_permission: {
    type: Number,
    default: 1
  },
  nonce: {
    require: true,
    type: Number,
    default: () => Math.floor(Math.random() * 1000000000) // Initialize with a random nonce
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
  enabled: {
    type : Boolean,
    default: true
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
schema.methods.getUserPermission = function() {
  return UserPermission._.role[this.user_permission];
}

schema.methods.validateSignature = function(signature) {
  const msg = `I am signing my one-time nonce: ${this.nonce}`;
  const msgBufferHex = bufferToHex(Buffer.from(msg, 'utf8'));
  const address = recoverPersonalSignature({
		data: msgBufferHex,
		sig: signature,
	});

  return address.toLowerCase() === this.public_address.toLowerCase();
}

schema.methods.generateNewNonce = function() {
  return new Promise(async (resolve, reject) => {
    this.nonce = Math.floor(Math.random() * 10000);

    try {
      await this.save();
      return resolve(this);
    } catch (e) {
      return reject(e);
    }
  });
}

schema.methods.export = function() {
  const data = Object.assign({}, this.toJSON());

  delete data.__v;
  delete data.local;
  data.user_permission = this.getUserPermission();
  data.id = data._id;
  delete data._id;
  delete data.nonce;
  delete data.refresh_key;
  return data;
}

/**
 * token
 * @return {[type]} [description]
 */
schema.methods.token = function(account, payload) {
  return new Promise(async (resolve, reject) => {
    let data = {
      account: account._id,
      user: this._id
    };

    if (payload && payload.constructor === Object) {
      data = Object.assign(data, payload);
    }

    const expiryTime = 60 * 60 * 24; // expires in 24 hours
  	const token = jwt.sign(data, process.env.SECRET, { expiresIn: expiryTime });

    try {
      const refresh = await this.refreshToken(account);

      return resolve({
        access_token: token,
        refresh_token: refresh,
        expires_in: expiryTime,
        token_type: 'Bearer',
        api_server: `${process.env.API_SERVER}/v${1}`,
        auth_server: `${process.env.AUTH_SERVER}/v${1}`
      });
    } catch (e) {
      return reject(e);
    }
  });
}

schema.methods.encrypt = function(data) {
  return new Promise(async (resolve, reject) => {
    try {
      const account = await Account.findById(this.account);
      const encrypted = await Cryption.encrypt(data, account.key);

      return resolve(encrypted);
    } catch (e) {
      return reject(e);
    }
  });
}

schema.methods.decrypt = function(data) {
  return new Promise(async (resolve, reject) => {
    try {
      const account = await Account.findById(this.account);
      const decrypted = await Cryption.decrypt(data, account.key);

      return resolve(decrypted);
    } catch (e) {
      return reject(e);
    }
  });
}
/**
 * Update
 * @param  {[type]} obj [description]
 * @return {[type]}     [description]
 */
schema.methods.update = function(obj, res) {
  return new Promise(async (resolve, reject) => {
    if (obj.user_permission) {
      const level = UserPermission._.code[obj.user_permission.toUpperCase()];

      if (level === undefined) {
        const e = new Error('Invalid user_permission');

        e.status = 406;
        return reject(e);
      }
      this.user_permission = level
    }
    if (obj.external_id) this.external_id = obj.external_id;
    if (obj.enabled !== undefined) this.enabled = Boolean(obj.enabled);
    if (obj.extensors) this.extensors = obj.extensors;
    if (res) this.record_history = GenerateRecordHistory(this.record_history, res);

    try {
      await this.save();
      return resolve(this);
    } catch (e) {
      return reject(e);
    }
  });
}

schema.methods.validateRefreshKey = function(refreshKey) {
  return this.refresh_key === refreshKey;
}

schema.methods.refreshToken = function(client) {
  return new Promise(async(resolve, reject) => {
    const refreshKey = Cryption.generateRandomKey();
    this.refresh_key = refreshKey

    try {
      await this.save();
      const data = {
        refresh_key: refreshKey,
        user: this._id
      };
      if (client) {
        data.client = client._id;
      }
    	return resolve(jwt.sign(data, process.env.SECRET));
    } catch (e) {
      return reject(e);
    }
  });
}

/**
 * SEND VALIDATION CODE
 * @param  {[type]}   title    [description]
 * @param  {[type]}   uri      [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
schema.methods.validationToken = function(res) {
  return new Promise(async (resolve, reject) => {
    try {
      const expiryTime = 60 * 60 * 24 * 7;
      const token = jwt.sign({ user: this._id }, process.env.SECRET, { expiresIn: expiryTime });

      await this.update({enabled: false}, res);
      return resolve(token);
    } catch (e) {
      return reject(e);
    }
  });
}

// statics ======================
/**
 * Query
 * @return {[type]}       [description]
 */
schema.statics.query = function(query = {}) {
 return new Promise(async (resolve, reject) => {
   let {
     show_disabled,
     offset,
     limit,
     all,
     search,
     enabled
   } = query;
   [
     'search',
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
/**
 * Get User By Account
 * @param  {[type]} account [description]
 * @return {[type]}      [description]
 */
schema.statics.getByAccount = function(account) {
  return this.findOne({ 'account': account });
}
/**
 * Create
 * @param  {[type]} obj     [description]
 * @param  {[type]} account [description]
 * @param  {[type]} res     [description]
 * @return {[type]}         [description]
 */
schema.statics.create = function(obj, account, res) {
  if (obj.public_address && account) {
    const user = new this;

    user.account = account._id;
    user.public_address = obj.public_address.toLowerCase();
    return user.update(obj, res);
  }
  const err = new Error('Minimum requirements of public_address must be provided to create new user.');

  err.status = 406
  return reject(err);
}

/**
 * Get By Public Address
 * @param  {[type]} address [description]
 * @return {[type]}       [description]
 */
schema.statics.getByPublicAddress = function(address) {
  return this.findOne({ 'public_address' : address.toLowerCase() });
}

schema.statics.isAdmin = function(user) {
  if (user && user.user_permission !== undefined) {
    return UserPermission._.role[user.user_permission] === UserPermission.ADMINISTRATOR;
  }
  return false;
}

schema.statics.isUser = function(user) {
  if (user && user.user_permission !== undefined) {
    return UserPermission._.role[user.user_permission] === UserPermission.USER;
  }
  return false;
}

let User;
try {
  User = mongoose.model('User');
} catch (error) {
  User = mongoose.model('User', schema);
}

User.on('index', e => {
  if (e) console.error(e.message)
});

module.exports = User;
