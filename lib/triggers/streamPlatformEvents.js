const elasticio = require('elasticio-node');
const messages = elasticio.messages;
const jsforce = require('jsforce');
const MetaLoader = require('../helpers/metaLoader');
const common = require('../common.js');
const logger = require('@elastic.io/component-logger')();

let conn;

/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``body`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
function processTrigger(msg, cfg) {
  const emitError = (e) => {
    logger.info(e);
    this.emit('error', e);
  };

  const emitEnd = () => {
    logger.info('Finished message processing');
    this.emit('end');
  };

  const emitKeys = (res) => {
    logger.info('Oauth tokens were updated');
    this.emit('updateKeys', { oauth: res });
  };

  if (!conn) {
    logger.info('Trying to connect to jsforce...');
    conn = new jsforce.Connection({
      oauth2: {
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
      },
      instanceUrl: cfg.oauth.instance_url,
      accessToken: cfg.oauth.access_token,
      refreshToken: cfg.oauth.refresh_token,
      version: common.globalConsts.SALESFORCE_API_VERSION,
    });
    conn.on('refresh', (accessToken, res) => {
      logger.debug('Keys were updated, res=%j', res);
      emitKeys(res);
    });

    conn.on('error', err => emitError(err));
    const topic = `/event/${cfg.object}`;
    const replayId = -1;
    const fayeClient = conn.streaming.createClient([
      new jsforce.StreamingExtension.Replay(topic, replayId),
      new jsforce.StreamingExtension.AuthFailure((err) => {
        emitError(new Error(`Unexpected error: ${JSON.stringify(err)}`));
      })
    ]);

    fayeClient.subscribe(topic, message => {
      logger.debug('Message: %j', message);
      this.emit('data', messages.newMessageWithBody(message));
    })
    .then(() => logger.info('Subscribed to PushTopic: ' + topic),
      err => emitError(err));
  }
  emitEnd();
}

/**
 * This function will be called to fetch available object types. *
 * Note: only updatable and creatable object types are returned here *
 * @param configuration
 */
async function getObjectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return await metaLoader.getPlatformEvents();
};

module.exports.process = processTrigger;
module.exports.objectTypes = getObjectTypes;
