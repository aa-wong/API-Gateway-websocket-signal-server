'use strict'

const mongoose = require('mongoose');

const {
  cryption,
  GenerateRecordHistory
} = require('../utils');
const { Cryption } = cryption;

/**
 * Account Level Enums
 * @type {[type]}
 */
const AccountPermission = Object.freeze({
  SUPERADMIN: 'SUPERADMIN',
  ADMINISTRATOR: 'ADMINISTRATOR',
  DOMAIN:'DOMAIN',
  _: {
    code: {
      SUPERADMIN: 0,
      ADMINISTRATOR: 1,
      DOMAIN: 2
    },
    role: {
      0: 'SUPERADMIN',
      1: 'ADMINISTRATOR',
      2: 'DOMAIN'
    }
  }
});

const Schema = mongoose.Schema;

const schema = new Schema({
  name: {
    type: String,
    required: false
  },
  key: {
    type: String,
    required: true
  },
  account_permission: {
    type: Number,
    default: 2
  },
  enabled: {
    type: Boolean,
    default: true
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
/**
 * get account level
 * @return {[type]} [description]
 */
schema.methods.accountPermission = function() {
  return AccountPermission._.role[this.account_permission];
}

/**
 * check if account is enabled
 * @return {[type]} [description]
 */
schema.methods.isEnabled = function() {
  return this.enabled;
}

/**
 * export
 * @return {[type]} [description]
 */
schema.methods.export = function() {
  const data = Object.assign({}, this.toJSON());
  delete data.key;
  delete data.__v;
  data.account_permission = this.accountPermission();
  data.id = data._id;
  delete data._id;
  return data;
}

/**
 * Decrypted Key
 * @return {[type]} [description]
 */
schema.methods.decryptedKey = function() {
  return Cryption.decrypt(this.key, process.env.SECRET);
}

/**
 * Update
 * @param  {[type]} obj [description]
 * @return {[type]}     [description]
 */
schema.methods.update = function(obj, res) {
  return new Promise(async (resolve, reject) => {
    if (obj.name) this.name = obj.name;
    if (!this.key && obj.key) this.key = obj.key;
    if (obj.account_permission) {
      const level = AccountPermission._.code[obj.account_permission.toUpperCase()];
      if (level === null) {
        const e = new Error('Invalid account_permission');

        e.status = 406;
        return reject(e);
      }
      this.account_permission = level
    }
    if (obj.enabled !== undefined) this.enabled = Boolean(obj.enabled);
    if (obj.external_id) this.external_id = obj.external_id;
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

// statics ======================
/**
 * Create Account
 * @param  {[type]} obj [description]
 * @return {[type]}     [description]
 */
schema.statics.create = function(obj, res) {
  return new Promise(async (resolve, reject) => {
    try {
      const account = new this;
      obj.key = await Cryption.encrypt(Cryption.generateRandomKey(), process.env.SECRET);
      const update = await account.update(obj, res);

      return resolve(update);
    } catch (e) {
      return reject(e);
    }
  });
}
/**
 * query
 * @param  {Object} [query={}] [description]
 * @return {[type]}            [description]
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
 * Enable By ID
 * @param  {[type]} id [description]
 * @return {[type]}    [description]
 */
schema.statics.enableById = function(id, res) {
  return new Promise(async (resolve, reject) => {
    if (id) {
      try {
        const acc = await this.findById(id);
        const update = await acc.update({enabled: true}, res);

        return resolve(update);
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
    if (id) {
      try {
        const acc = await this.findById(id);
        const update = await acc.update({enabled: false}, res);

        return resolve(update);
      } catch (e) {
        return reject(e);
      }
    }
    const e = new Error('id is invalid');

    e.status = 406
    return reject(e);
  });
}

schema.statics.isSuperAdmin = function(acc) {
  if (acc && acc.account_permission !== undefined) {
    return AccountPermission._.role[acc.account_permission] === AccountPermission.SUPERADMIN;
  }
  return false;
}

schema.statics.isAdmin = function(acc) {
  if (acc && acc.account_permission !== undefined) {
    return AccountPermission._.role[acc.account_permission] === AccountPermission.ADMINISTRATOR;
  }
  return false;
}

schema.statics.isDomain = function(acc) {
  if (acc && acc.account_permission !== undefined) {
    return AccountPermission._.role[acc.account_permission] === AccountPermission.DOMAIN;
  }
  return false;
}

let Account;
try {
  Account = mongoose.model('Account');
} catch (error) {
  Account = mongoose.model('Account', schema);
}

Account.on('index', e => {
  if (e) console.error(e.message)
});

module.exports = Account;
