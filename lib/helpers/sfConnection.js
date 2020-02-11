const jsforce = require('jsforce');
<<<<<<< HEAD
const common = require('../common.js'); 
=======
const common = require('../common.js');

>>>>>>> 865ca3a2219cbc12f479ab30f9a1ac8ea340852f

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
<<<<<<< HEAD
    },
  );

  connection.on('refresh', (accessToken, res) => {
    emitter.logger.info(`Heres the data: ${JSON.stringify(res)}`)
=======
  });

  connection.on('refresh', (accessToken, res) => {
>>>>>>> 865ca3a2219cbc12f479ab30f9a1ac8ea340852f
    emitter.logger.debug('Keys were updated, res=%j', res);
    emitter.emit('updateKeys', { oauth: res });
  });

  connection.on('error', err => emitter.emit('error', err));

  return connection;
<<<<<<< HEAD
}; 
=======
};
>>>>>>> 865ca3a2219cbc12f479ab30f9a1ac8ea340852f
