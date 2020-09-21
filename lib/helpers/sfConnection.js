const jsforce = require('jsforce');
const common = require('../common.js');

exports.createConnection = async function createConnection(accessToken, emitter) {
  const connection = new jsforce.Connection({
    instanceUrl: 'https://na98.salesforce.com',
    accessToken,
    version: common.globalConsts.SALESFORCE_API_VERSION,
  });

  connection.on('error', (err) => {
    emitter.emit('error', err);
  });

  return connection;
};
