const jsforce = require('jsforce');
const { messages } = require('elasticio-node');
const { callJSForceMethod } = require('../helpers/wrapper');
const { getSecret, refreshToken } = require('../util');
const { SALESFORCE_API_VERSION } = require('../common.js').globalConsts;

/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``body`` with payload
 * @param configuration configuration that is account information and configuration field values
 */
async function processTrigger(msg, configuration) {
  this.logger.info('Starting Subscribe to platform events Trigger');
  const { secretId } = configuration;
  if (!secretId) {
    this.logger.error('secretId is missing in configuration, credentials cannot be fetched');
    throw new Error('secretId is missing in configuration, credentials cannot be fetched');
  }
  this.logger.debug('Fetching credentials by secretId');
  const { credentials } = await getSecret(this, secretId);
  const accessToken = credentials.access_token;
  const instanceUrl = credentials.undefined_params.instance_url;
  this.logger.trace('AccessToken = %s', accessToken);
  this.logger.debug('Preparing SalesForce connection...');
  const connection = new jsforce.Connection({
    instanceUrl,
    accessToken,
    version: SALESFORCE_API_VERSION,
  });
  const topic = `/event/${configuration.object}`;
  const replayId = -1;
  this.logger.debug('Creating streaming client');
  const fayeClient = connection.streaming.createClient([
    new jsforce.StreamingExtension.Replay(topic, replayId),
    new jsforce.StreamingExtension.AuthFailure(async (err) => {
      this.logger.trace('AuthFailure: %j', err);
      if (err.ext && err.ext.sfdc && err.ext.sfdc.failureReason && (err.ext.sfdc.failureReason === '401::Authentication invalid')) {
        try {
          this.logger.debug('Session is expired, trying to refresh token');
          await refreshToken(this, secretId);
          this.logger.debug('Token is successfully refreshed');
        } catch (error) {
          this.logger.trace('Refresh token error: %j', error);
          this.logger.error('Failed to fetch and/or refresh token');
          throw new Error('Failed to fetch and/or refresh token');
        }
        this.logger.info('Lets call processTrigger one more time');
        await processTrigger.call(this, msg, configuration);
      } else {
        this.logger.error('AuthFailure extension error occurred');
        throw err;
      }
    }),
  ]);

  fayeClient.subscribe(topic, async (message) => {
    this.logger.info('Incoming message found, going to emit...');
    this.logger.trace('Incoming Message: %j', message);
    await this.emit('data', messages.newMessageWithBody(message));
  })
    .then(() => {
      this.logger.info('Subscribed to PushTopic successfully');
      this.logger.trace(`Subscribed to PushTopic: ${topic}`);
    },
    (err) => {
      this.logger.error('Subscriber error occurred');
      throw err;
    });
  this.logger.info('Streaming client created and ready');
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
