const { ApiGatewayManagementApi } = require('aws-sdk');

const create = (event) => {
  const {
    domainName,
    stage
  } = event.requestContext;

  return new ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: `${domainName}/${stage}`
  });
};

const closeSelf = (event) => {
  const { connectionId } = event.requestContext;

  return close(event, connectionId);
};

const close = (event, ConnectionId) => {
  const ws = create(event);

  return ws.deleteConnection({ ConnectionId });
};

const send = (event, ConnectionId, Data) => {
  const ws = create(event);

  return ws.postToConnection({
    Data,
    ConnectionId
  }).promise();
};

module.exports = {
  send,
  close,
  closeSelf,
  create
};
