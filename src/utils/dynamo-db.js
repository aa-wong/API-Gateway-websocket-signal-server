'use strict';

const { DynamoDB } = require('aws-sdk');

class Dynamo {
  constructor(table) {
    this.documentClient = new DynamoDB.DocumentClient();
    this.table = table
  }

  async get(id) {
    try {
      const params = {
        TableName: this.table,
        Key: {
          id
        }
      };

      const data = await this.documentClient.get(params).promise();

      if (!data || !data.Item) {
        return Promise.reject(new Error(`There was an error fetching the data for ID of ${ID} from ${table}`));
      }

      return Promise.resolve(data.Item);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async write(data) {
    try {
      if (!data.ID) {
        return Promise.reject(new Error('no ID on the data'));
      }

      const params = {
        TableName: this.table,
        Item: data,
      };

      const res = await this.documentClient.put(params).promise();

      if (!res) {
        return Promise.reject(new Error(`There was an error inserting ID of ${data.ID} in table ${DYNAMO_TABLE_NAME}`));
      }

      return Promise.resolve(data);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  delete(id) {
    const params = {
      TableName: this.table,
      Key: {
        id
      }
    }

    return this.documentClient.delete(params).promise();
  }
}
module.exports = Dynamo;
