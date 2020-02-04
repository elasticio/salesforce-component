const jsforce = require('jsforce');
const { messages } = require('elasticio-node');
const common = require('../common.js');


function getConnection(configuration) {
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
    },
    instanceUrl: configuration.oauth.instance_url,
    accessToken: configuration.oauth.access_token,
    refreshToken: configuration.oauth.refresh_token,
    version: common.globalConsts.SALESFORCE_API_VERSION,
  });
  conn.on('refresh', (accessToken, res) => {
    this.logger.info('Keys were updated, res=%j', res);
    this.emit('updateKeys', { oauth: res });
  });
  return conn;
}


async function emitBatch(message, configuration) {
  const self = this;
  const { logger } = this;
  let batch = [];
  const promises = [];
  const connection = getConnection.call(self, configuration);
  await new Promise((resolve, reject) => {
    const response = connection.query(message.body.query)
      .scanAll(configuration.includeDeleted)
      .on('record', (record) => {
        batch.push(record);
        if (batch.length >= configuration.batchSize) {
          logger.info('Ready batch: %j', batch);
          promises.push(self.emit('data', messages.newMessageWithBody({ result: batch })));
          batch = [];
        }
      })
      .on('end', () => {
        if (response.totalFetched === 0) {
          promises.push(self.emit('data', messages.newMessageWithBody({})));
        }
        if (batch.length > 0) {
          logger.info('Last batch: %j', batch);
          promises.push(self.emit('data', messages.newMessageWithBody({ result: batch })));
        }
        logger.info('Total in database=%s', response.totalSize);
        logger.info('Total fetched=%s', response.totalFetched);
        resolve();
      })
      .on('error', (err) => {
        logger.error(err);
        promises.push(emitter.emit('error', err));
        reject(err);
      })
      .run({ autoFetch: true, maxFetch: 1000 });
  });
  await Promise.all(promises);
}

async function emitIndividually(message, configuration) {
  const self = this;
  const { logger } = this;
  const promises = [];
  const connection = getConnection.call(self, configuration);
  await new Promise((resolve, reject) => {
    const response = connection.query(message.body.query)
      .scanAll(configuration.includeDeleted)
      .on('record', (record) => {
        logger.info('Emitting record: %j', record);
        promises.push(self.emit('data', messages.newMessageWithBody(record)));
      })
      .on('end', function () {
        if (response.totalFetched === 0) {
          promises.push(self.emit('data', messages.newMessageWithBody({})));
        }
        logger.info('Total in database=%s', response.totalSize);
        logger.info('Total fetched=%s', response.totalFetched);
        resolve();
      })
      .on('error', (err) => {
        logger.error(err);
        promises.push(self.emit('error', err));
        reject(err);
      })
      .run({ autoFetch: true, maxFetch: 1000 });
  });
  await Promise.all(promises);
}

async function emitAll(message, configuration) {
  const self = this;
  const { logger } = this;
  const result = [];
  const connection = getConnection.call(self, configuration);
  await new Promise((resolve, reject) => {
    const response = connection.query(message.body.query)
      .scanAll(configuration.includeDeleted)
      .on('record', (record) => {
        result.push(record);
      })
      .on('end', function () {
        logger.info('Result: %j', result);
        logger.info('Total in database=%s', response.totalSize);
        logger.info('Total fetched=%s', response.totalFetched);
        if (response.totalFetched === 0) {
          resolve(self.emit('data', messages.newMessageWithBody({})));
        }
        if (result.length > 0) {
          resolve(self.emit('data', messages.newMessageWithBody({ result })));
        }
      })
      .on('error', (err) => {
        logger.error(err);
        reject(emit('error', err));
      });
  });
}

exports.process = async function processAction(message, configuration) {
  const { logger } = this;
  logger.trace('Input configuration: %j', configuration);
  logger.trace('Input message: %j', message);
  let batchSize = configuration.batchSize || 0;
  if (isNaN(batchSize)) {
    throw new Error("batchSize must be a number");
  }
  logger.info('Starting SOQL Select batchSize=%s query=%s', batchSize, message.body.query);
  if (configuration.allowResultAsSet) {
    logger.info('Selected EmitAllHandler');
    await emitAll.call(this, message, configuration);
    return;
  }
  if (configuration.batchSize > 0) {
    logger.info('Selected EmitBatchHandler');
    await emitBatch.call(this, message, configuration);
    return;
  }
  logger.info('Selected EmitIndividuallyHandler');
  await emitIndividually.call(this, message, configuration);
};


