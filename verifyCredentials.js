const request = require('request');
const fs = require('fs');

const NOT_ENABLED_ERROR = 'Salesforce respond with this error: "The REST API is not enabled for this Organization."';
const VERSION = 'v32.0';
const debug = require('debug')('verifyCredentials');
const debugToken = require('debug')('token');

if (fs.existsSync('.env')) {
  // eslint-disable-next-line global-require
  require('dotenv').config();
}

// eslint-disable-next-line consistent-return
module.exports = function verify(credentials, cb) {
// eslint-disable-next-line no-use-before-define
  checkOauth2EnvarsPresence();

  function checkResponse(err, response, body) {
    if (err) {
      return cb(err);
    }
    debug('Salesforce response was: %s %j', response.statusCode, body);
    if (response.statusCode === 401) {
      return cb(null, { verified: false });
    }
    if (response.statusCode === 403) {
      return cb(null, { verified: false, details: NOT_ENABLED_ERROR });
    }
    if (response.statusCode !== 200) {
      return cb(new Error(`Salesforce respond with ${response.statusCode}`));
    }
    return cb(null, { verified: true });
  }
  debugToken(credentials);
  if (!credentials.oauth || credentials.oauth.error) {
    return cb(null, { verified: false });
  }
  const token = credentials.oauth.access_token;
  const url = `${credentials.oauth.instance_url}/services/data/${VERSION}/sobjects`;

  debug('To verify credentials send request to %s', url);

  const options = {
    url,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  request.get(options, checkResponse);
};

function checkOauth2EnvarsPresence() {
  if (!process.env.OAUTH_CLIENT_ID) {
    if (!process.env.OAUTH_CLIENT_SECRET) {
      throw new Error('Environment variables are missed: OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET');
    }
    throw new Error('Environment variables are missed: OAUTH_CLIENT_ID');
  } else if (!process.env.OAUTH_CLIENT_SECRET) {
    throw new Error('Environment variables are missed: OAUTH_CLIENT_SECRET');
  }
}
