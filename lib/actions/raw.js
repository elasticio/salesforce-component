/* eslint-disable no-await-in-loop */
const { messages } = require('elasticio-node');
const { SalesForceClient } = require('../salesForceClient');
const { getSecret, refreshToken } = require('../helpers/oauth2Helper');


exports.process = async function process(message, configuration) {
  this.logger.info('Incoming configuration: %j', configuration);
  const secret = await getSecret(this, configuration.secretId);
  this.logger.info('Found secret: %j', secret);
  let accessToken = secret.credentials.access_token;
  this.logger.info('Fetched accessToken: %s', accessToken);
  let result;
  let iteration = 3;
  do {
    iteration -= 1;
    try {
      this.logger.info('Iteration %s, try to create connection', iteration);
      // eslint-disable-next-line max-len
      const client = new SalesForceClient(this, { access_token: accessToken, instanceUrl: secret.credentials.instance_url });
      this.logger.info('Connection is created, trying to describeGlobal...');
      result = await client.describeGlobal();
      this.logger.info('Credentials are valid, sobjects count: %s', result.sobjects.length);
      break;
    } catch (e) {
      this.logger.error('got error', e);
      if (e.name === 'INVALID_SESSION_ID') {
        try {
          this.logger.info('going to refresh token', configuration);
          accessToken = await refreshToken(this, configuration.secretId);
          this.logger.info('refreshed token', accessToken);
        } catch (err) {
          this.logger.error(err, 'failed to refresh token');
        }
      } else {
        throw e;
      }
    }
  } while (iteration > 0);
  if (!result) {
    throw new Error('failed to fetch and/or refresh token, retries exceeded');
  }
  return messages.newMessageWithBody({ result: true });
};
