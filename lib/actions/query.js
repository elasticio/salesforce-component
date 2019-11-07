const jsforce = require('jsforce');
const messages = require('elasticio-node').messages;

/**
 * See list on https://na45.salesforce.com/services/data/
 * @type {string}
 */
const SALESFORCE_API_VERSION = process.env.SALESFORCE_API_VERSION || '45.0';

exports.process = function processAction(msg, conf) {
  let batchSize = 0, result = [];
  if (conf.batchSize) {
    try {
      batchSize = Math.max(0, parseInt(conf.batchSize));
    } catch (ignored) {
    }
  }
  const { allowResultAsSet } = conf;
  console.log('Starting SOQL Select batchSize=%s query=%s', batchSize, msg.body.query);
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      redirectUri: 'https://app.elastic.io/oauth/v2'
    },
    instanceUrl: conf.oauth.instance_url,
    accessToken: conf.oauth.access_token,
    refreshToken: conf.oauth.refresh_token,
    version: SALESFORCE_API_VERSION
  });
  conn.on('refresh', (accessToken, res) => {
    console.log('Keys were updated, res=%j', res);
    this.emit('updateKeys', { oauth: res });
  });
  conn.query(msg.body.query)
  .on("record", (record) => {
    if (allowResultAsSet) {
      result.push(record);
    } else if (batchSize > 0) {
      result.push(record);
      if (result.length >= batchSize) {
        this.emit('data', messages.newMessageWithBody({ result }));
        result = [];
      }
    } else {
      result.push(record);
      this.emit('data', messages.newMessageWithBody(result[0]));
    }
  })
  .on("end", () => {
    console.log("Result:", result);
    if (result.length === 0) {
      this.emit('data', messages.newMessageWithBody({}));
    }
    if ((allowResultAsSet || batchSize > 0) && (result.length > 0)) {
      this.emit('data', messages.newMessageWithBody({ result }));
    }
    console.log("total in database=%s", result.totalSize);
    console.log("total fetched=%s", result.totalFetched);
    this.emit('end');
  })
  .on("error", (err) => {
    console.error(err);
    this.emit('error', err);
  })
  .run({ autoFetch: true, maxFetch: 1000 });
};
