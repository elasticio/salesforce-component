const jsforce = require('jsforce');
const common = require('../common.js');


exports.createConnection = function createConnection(configuration, emitter) {
  const connection = new jsforce.Connection({
    oauth2: {
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
    },
    instanceUrl: configuration.oauth.instance_url,
    accessToken: configuration.oauth.access_token,
    refreshToken: configuration.oauth.refresh_token,
    version: common.globalConsts.SALESFORCE_API_VERSION,
  });

  connection.on('refresh', (accessToken, res) => {
    emitter.logger.debug('Keys were updated');
    emitter.emit('updateKeys', { oauth: res });
  });

  connection.on('error', err => emitter.emit('error', err));

  return connection;
};
