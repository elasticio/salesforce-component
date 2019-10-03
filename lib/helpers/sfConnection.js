'use strict';

const common = require('../common.js');
const jsforce = require('jsforce');
const debug = require('debug')('salesforce:auth');


exports.createConnection = function (configuration, emitter) {
  const connection = new jsforce.Connection({
    oauth2: {
      clientId: process.env.SALESFORCE_KEY,
      clientSecret: process.env.SALESFORCE_SECRET,
      redirectUri: 'https://app.elastic.io/oauth/v2',
    },
    instanceUrl: configuration.oauth.instance_url,
    accessToken: configuration.oauth.access_token,
    refreshToken: configuration.oauth.refresh_token,
    version: common.globalConsts.SALESFORCE_API_VERSION,
  });

  connection.on('refresh', (accessToken, res) => {
    debug('Keys were updated, res=%j', res);
    emitter.emit('updateKeys', { oauth: res });
  });

  connection.on('error', err => emitter.emit('error', err));

  return connection;
}
