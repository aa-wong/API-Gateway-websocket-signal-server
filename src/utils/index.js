'use strict';

const GenerateRecordHistory = (record, caller) => {
  if (caller) {
    record = record !== undefined ? record : {};
    const requestUser = caller.requestUser ? caller.requestUser : caller.requestClient;
    const type = caller.requestUser ? 'USER' : 'CLIENT';
    if (record.created_by) {
      record.updated_at = Date.now();
      record.updated_by = requestUser !== undefined ? requestUser._id : null;
      record.updated_by_type = type !== undefined ? type : null;
    } else {
      record.created_at = Date.now();
      record.created_by = requestUser !== undefined ? requestUser._id : null;
      record.created_by_type = type !== undefined ? type : null;
    }
  }
  return record;
}

module.exports = {
  cryption: require('./cryption'),
  Dynamo: require('./dynamo-db'),
  Http: require('./http-engine'),
  ResponseConstructor: require('./response-constructor'),
  ErrorTemplate: require('./error-template'),
  GenerateRecordHistory: GenerateRecordHistory
};
