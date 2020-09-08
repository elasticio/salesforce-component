/* eslint-disable no-await-in-loop */
const { SalesForceClient } = require('../salesForceClient');
const { getCredentials, refreshToken } = require('../helpers/oauth2Helper');
const { REFRESH_TOKEN_RETRIES } = require('../common.js').globalConsts;

let client;

exports.callJSForceMethod = async function callJSForceMethod(configuration, method, options) {
  this.logger.info('Preparing SalesForce Client...');
  let accessToken;
  let instanceUrl;
  const { secretId } = configuration;
  if (secretId) {
    this.logger.info('Fetching credentials by secretId');
    const credentials = await getCredentials(this, secretId);
    accessToken = credentials.access_token;
    instanceUrl = credentials.instance_url;
  } else {
    this.logger.info('Fetching credentials from configuration');
    accessToken = configuration.oauth.access_token;
    instanceUrl = configuration.oauth.instance_url;
  }
  let result;
  let isSuccess = false;
  let iteration = REFRESH_TOKEN_RETRIES;
  do {
    iteration -= 1;
    try {
      this.logger.info('Iteration: %s', REFRESH_TOKEN_RETRIES - iteration);
      const cfg = {
        ...configuration,
        access_token: accessToken,
        instance_url: instanceUrl,
      };
      if (!client || Object.entries(client.configuration).toString() !== Object.entries(cfg).toString()) {
        this.logger.info('Try to create SalesForce Client', REFRESH_TOKEN_RETRIES - iteration);
        this.logger.trace('Creating SalesForce Client with configuration: %j', cfg);
        client = new SalesForceClient(this, cfg);
        this.logger.info('SalesForce Client is created');
      }
      this.logger.info('Trying to call method %s', method);
      this.logger.debug('Trying to call method %s with options: %j', method, options);
      result = await client[method](options);
      this.logger.debug('Execution result: %j', result);
      isSuccess = true;
      this.logger.info('Method is executed successfully');
      break;
    } catch (e) {
      this.logger.error('Got error: ', e);
      if (e.name === 'INVALID_SESSION_ID') {
        try {
          this.logger.info('Session is expired, trying to refresh token...');
          this.logger.trace('Going to refresh token for secretId: %s', secretId);
          accessToken = await refreshToken(this, secretId);
          this.logger.info('Token is successfully refreshed');
          this.logger.trace('Refreshed token: ', accessToken);
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
