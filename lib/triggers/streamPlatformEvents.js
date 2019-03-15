const elasticio = require('elasticio-node');
const messages = elasticio.messages;
const debug = require('debug')('salesforce:stream');
const jsforce = require('jsforce');
const MetaLoader = require('../helpers/metaLoader');
const SALESFORCE_API_VERSION = '39.0';

let conn;

/**
 * This method will be called from elastic.io platform providing following data
 *
 * @param msg incoming message object that contains ``body`` with payload
 * @param cfg configuration that is account information and configuration field values
 */
function processTrigger(msg, cfg) {
  const emitError = (e)  => {
    console.log(e);
    this.emit('error', e);
  };

  const emitEnd = () => {
    console.log('Finished message processing');
    this.emit('end');
  };

  const emitKeys = (res) => {
    console.log('Oauth tokens were updated');
    this.emit('updateKeys', { oauth: res });
  };

  if (!conn) {
    console.log('Trying to connect to jsforce...');
    conn = new jsforce.Connection({
      oauth2: {
        clientId: process.env.SALESFORCE_KEY,
        clientSecret: process.env.SALESFORCE_SECRET,
        redirectUri: 'https://app.elastic.io/oauth/v2',
      },
      instanceUrl: cfg.oauth.instance_url,
      accessToken: cfg.oauth.access_token,
      refreshToken: cfg.oauth.refresh_token,
      version: SALESFORCE_API_VERSION,
    });
    conn.on('refresh', (accessToken, res) => {
      debug('Keys were updated, res=%j', res);
      emitKeys(res);
    });
    conn.on('error', err => emitError(err));

    const topic = `/event/${cfg.object}`;
    conn.streaming.topic(topic)
      .subscribe(message => {
        debug('Message: %j', message);
        this.emit('data', messages.newMessageWithBody(message));
      })
      .then(() => console.log('Subscribed to PushTopic: ' + topic),
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
  const metaLoader = new MetaLoader(configuration);
  return await metaLoader.getPlatformEvents();
};

module.exports.process = processTrigger;
module.exports.objectTypes = getObjectTypes;
