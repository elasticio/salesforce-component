const jsforce = require('jsforce');
const { messages } = require('elasticio-node');
const { callJSForceMethod } = require('../helpers/wrapper');
const { getCredentials, refreshToken } = require('../helpers/oauth2Helper');
const { REFRESH_TOKEN_RETRIES, SALESFORCE_API_VERSION } = require('../common.js').globalConsts;

let connection;
/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``body`` with payload
 * @param configuration configuration that is account information and configuration field values
 */
async function processTrigger(msg, configuration) {
  this.logger.debug('Preparing SalesForce Client...');
  let accessToken;
  let instanceUrl;
  const { secretId } = configuration;
  if (secretId) {
    this.logger.debug('Fetching credentials by secretId');
    const credentials = await getCredentials(this, secretId);
    accessToken = credentials.access_token;
    instanceUrl = credentials.undefined_params.instance_url;
  } else {
    throw new Error('Can not find credentials');
  }
  let isSuccess = false;
  let iteration = REFRESH_TOKEN_RETRIES;
  do {
    iteration -= 1;
    try {
      this.logger.debug('Iteration: %s', REFRESH_TOKEN_RETRIES - iteration);
      this.logger.trace('AccessToken = %s, Iteration: %s', accessToken, REFRESH_TOKEN_RETRIES - iteration);
      if (!connection) {
        connection = new jsforce.Connection({
          instanceUrl,
          accessToken,
          version: SALESFORCE_API_VERSION,
        });
        const topic = `/event/${configuration.object}`;
        const replayId = -1;
        const fayeClient = connection.streaming.createClient([
          new jsforce.StreamingExtension.Replay(topic, replayId),
        ]);

        fayeClient.subscribe(topic, (message) => {
          this.logger.debug('Message: %j', message);
          this.emit('data', messages.newMessageWithBody(message));
        })
          .then(() => this.logger.info(`Subscribed to PushTopic: ${topic}`),
            (err) => { throw err; });
      }

      isSuccess = true;
      break;
    } catch (e) {
      this.logger.error('Got error: %s', e.name);
      if (e.name === 'INVALID_SESSION_ID') {
        try {
          this.logger.debug('Session is expired, trying to refresh token...');
          accessToken = await refreshToken(this, secretId);
          this.logger.debug('Token is successfully refreshed');
          connection = undefined;
        } catch (err) {
          this.logger.error('Failed to refresh token');
        }
      } else {
        throw e;
      }
    }
  } while (iteration > 0);
  if (!isSuccess) {
    throw new Error('Failed to fetch and/or refresh token, retries exceeded');
  }
}

/**
 * This function will be called to fetch available object types. *
 * Note: only updatable and creatable object types are returned here *
 * @param configuration
 */
async function getObjectTypes(configuration) {
  return callJSForceMethod.call(this, configuration, 'getPlatformEvents');
}

module.exports.process = processTrigger;
module.exports.objectTypes = getObjectTypes;
