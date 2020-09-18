/* eslint-disable no-await-in-loop */
const { SalesForceClient } = require('../salesForceClient');
const { getCredentials, refreshToken } = require('./oauth2Helper');
const { REFRESH_TOKEN_RETRIES } = require('../common.js').globalConsts;

let client;

exports.callJSForceMethod = async function callJSForceMethod(configuration, method, options) {
  this.logger.debug('Preparing SalesForce Client...');
  let accessToken;
  let instanceUrl;
  const { secretId } = configuration;
  if (secretId) {
    this.logger.debug('Fetching credentials by secretId');
    const credentials = await getCredentials(this, secretId);
    accessToken = credentials.access_token;
    instanceUrl = credentials.instance_url;
  } else {
    this.logger.debug('Fetching credentials from configuration');
    accessToken = configuration.oauth.access_token;
    instanceUrl = configuration.oauth.instance_url;
  }
  let result;
  let isSuccess = false;
  let iteration = REFRESH_TOKEN_RETRIES;
  do {
    iteration -= 1;
    try {
      this.logger.debug('Iteration: %s', REFRESH_TOKEN_RETRIES - iteration);
      this.logger.trace('AccessToken = %s, Iteration: %s', accessToken, REFRESH_TOKEN_RETRIES - iteration);
      const cfg = {
        ...configuration,
        access_token: accessToken,
        instance_url: instanceUrl,
      };
      if (!client || Object.entries(client.configuration).toString() !== Object.entries(cfg).toString()) {
        this.logger.debug('Try to create SalesForce Client', REFRESH_TOKEN_RETRIES - iteration);
        client = new SalesForceClient(this, cfg);
        this.logger.debug('SalesForce Client is created');
      }
      this.logger.debug('Trying to call method %s', method);
      result = await client[method](options);
      isSuccess = true;
      this.logger.debug('Method %s was successfully executed', method);
      break;
    } catch (e) {
      this.logger.error('Got error: ', e);
      if (e.name === 'INVALID_SESSION_ID') {
        try {
          this.logger.debug('Session is expired, trying to refresh token...');
          accessToken = await refreshToken(this, secretId);
          this.logger.debug('Token is successfully refreshed');
          client = undefined;
        } catch (err) {
          this.logger.error(err, 'Failed to refresh token');
        }
      } else {
        throw e;
      }
    }
  } while (iteration > 0);
  if (!isSuccess) {
    throw new Error('Failed to fetch and/or refresh token, retries exceeded');
  }
  return result;
};
