const request = require('request');
const NOT_ENABLED_ERROR = 'Salesforce respond with this error: "The REST API is not enabled for this Organization."';
const VERSION = 'v32.0';
const debug = require('debug')('verifyCredentials');
const debugToken = require('debug')('token');

module.exports = verify;

function verify(credentials, cb) {
  debugToken(credentials);
  if (!credentials.oauth || credentials.oauth.error) {
    return cb(null, {verified: false});
  }
  const token = credentials.oauth.access_token;
  const url = credentials.oauth.instance_url + '/services/data/' + VERSION +
      '/sobjects';

  debug('To verify credentials send request to %s', url);

  const options = {
    url: url,
    headers: {
      Authorization: 'Bearer ' + token,
    },
  };

  request.get(options, checkResponse);

  function checkResponse(err, response, body) {
    if (err) {
      return cb(err);
    }
    debug('Salesforce response was: %s %j', response.statusCode, body);
    if (response.statusCode === 401) {
      return cb(null, {verified: false});
    }
    if (response.statusCode === 403) {
      return cb(null, {verified: false, details: NOT_ENABLED_ERROR});
    }
    if (response.statusCode !== 200) {
      return cb(new Error('Salesforce respond with ' + response.statusCode));
    }
    cb(null, {verified: true});
  }
}
