/* eslint-disable no-await-in-loop */
const { SalesForceClient } = require('../salesForceClient');
const { getCredentials, refreshToken } = require('../helpers/oauth2Helper');

let client;

exports.callJSForceMethod = async function callJSForceMethod(configuration, method, options) {
  this.logger.trace('Incoming configuration: %j', configuration);
  let accessToken;
  let instanceUrl;
  const { secretId } = configuration;
  if (secretId) {
    const credentials = await getCredentials(this, secretId);
    this.logger.trace('Fetched credentials: %j', credentials);
    accessToken = credentials.access_token;
    instanceUrl = credentials.instance_url;
  } else {
    accessToken = configuration.oauth.access_token;
    instanceUrl = configuration.oauth.instance_url;
  }
  let result;
  let isSuccess = false;
  let iteration = 3;
  do {
    iteration -= 1;
    try {
      this.logger.info('Iteration: %s', iteration);
      const cfg = {
        ...configuration,
        access_token: accessToken,
        instance_url: instanceUrl,
      };
      if (!client || Object.entries(client.configuration).toString() !== Object.entries(cfg).toString()) {
        this.logger.info('Try to create connection', iteration);
        client = new SalesForceClient(this, cfg);
        this.logger.info('Connection is created');
      }
      this.logger.info('Trying to call method %s with options: %j', method, options);
      result = await client[method](options);
      this.logger.trace('Execution result: %j', result);
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
