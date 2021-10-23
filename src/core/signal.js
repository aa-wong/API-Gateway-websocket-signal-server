'use strict'

const {
  Schema,
  model
} = require('mongoose');
const { GenerateRecordHistory } = require('../utils');

const schema = new Schema({
  account: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: false
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  connectionId: {
    type: String,
    required: true
  },
  external_id: {
    type: String,
    required: false
  },
  extensors: {
    type: Object,
    required: false
  },
  enabled: {
    type : Boolean,
    default: true
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
 * check if enabled
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
  delete data.__v;
  data.id = data._id;
  delete data._id;
  return data;
}

/**
 * Update
 * @param  {[type]} obj [description]
 * @return {[type]}     [description]
 */
schema.methods.update = function(obj, caller) {
  return new Promise(async (resolve, reject) => {
    if (obj.extensors) this.extensors = obj.extensors;
    if (obj.external_id) this.external_id = obj.external_id;
    if (obj.enabled !== undefined) this.enabled = obj.enabled;
    if (caller) this.record_history = GenerateRecordHistory(this.record_history, caller);

    try {
      await this.save();

      return resolve(this);
    } catch (e) {
      e.status = 500;
      return reject(e);
    }
  });
}

// statics ======================
/**
 * Create
 * @param  {[type]} obj [description]
 * @return {[type]}     [description]
 */
schema.statics.create = function(obj, caller) {
  const s = new this;
  const {
    requestAccount,
    requestClient,
    requestUser
  } = caller;

  if (requestUser) s.user = requestUser;
  if (requestClient) s.client = requestClient;
  s.connectionId = obj.connectionId;
  s.account = requestAccount;

  return s.update(obj, caller);
}

schema.statics.findByConnectionId = function(connectionId) {
  return this.findOne({ connectionId });
}

schema.statics.deleteByConnectionId = function(connectionId) {
  return new Promise(async (resolve, reject) => {
    try {
      const signal = await this.findByConnectionId(connectionId);
      if (!signal) {
        const e = new Error(`No signal found with connection ID: ${connectionId}`);

        e.status = 404;
        return resolve(e);
      }
      await this.findByIdAndDelete(signal._id);

      return resolve();
    } catch (e) {
      return resolve(e);
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

let Signal;
try {
  Signal = model('Signal');
} catch (error) {
  Signal = model('Signal', schema);
}

module.exports = Signal;
