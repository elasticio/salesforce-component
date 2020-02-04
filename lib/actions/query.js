const jsforce = require('jsforce');
const { messages } = require('elasticio-node');
const common = require('../common.js');


function getConnection(context, conf) {
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
    },
    instanceUrl: conf.oauth.instance_url,
    accessToken: conf.oauth.access_token,
    refreshToken: conf.oauth.refresh_token,
    version: common.globalConsts.SALESFORCE_API_VERSION,
  });
  conn.on('refresh', (accessToken, res) => {
    context.logger.info('Keys were updated, res=%j', res);
    context.emit('updateKeys', { oauth: res });
  });
  return conn;
}


class EmitBatchHandler {
  constructor(context, message, configuration) {
    this.context = context;
    this.logger = context.logger;
    this.message = message;
    this.connection = getConnection(context, configuration);
    this.configuration = configuration;
  }

  async call() {
    const { logger } = this;
    const { emit } = this.context;
    let batch = [];
    let { configuration } = this;
    const promises = [];
    await new Promise((resolve, reject) => {
      const response = this.connection.query(this.message.body.query)
        .scanAll(configuration.includeDeleted)
        .on('record', (record) => {
          batch.push(record);
          if (batch.length >= configuration.batchSize) {
            logger.info('Ready batch: %j', batch);
            promises.push(emit('data', messages.newMessageWithBody({ result: batch })));
            batch = [];
          }
        })
        .on('end', () => {
          if (response.totalFetched === 0) {
            promises.push(emit('data', messages.newMessageWithBody({})));
          }
          if (batch.length > 0) {
            logger.info('Last batch: %j', batch);
            promises.push(emit('data', messages.newMessageWithBody({ result: batch })));
          }
          logger.info('Total in database=%s', response.totalSize);
          logger.info('Total fetched=%s', response.totalFetched);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(err);
          promises.push(this.context.emit('error', err));
          reject(err);
        })
        .run({ autoFetch: true, maxFetch: 1000 });
    });
    await Promise.all(promises);
  }
}

class EmitIndividuallyHandler {
  constructor(context, message, configuration) {
    this.context = context;
    this.logger = context.logger;
    this.message = message;
    this.connection = getConnection(context, configuration);
    this.configuration = configuration;
  }

  async call() {
    const { logger } = this;
    const { emit } = this.context;
    const promises = [];
    await new Promise((resolve, reject) => {
      const response = this.connection.query(this.message.body.query)
        .scanAll(this.configuration.includeDeleted)
        .on('record', (record) => {
          logger.info('Emitting record: %j', record);
          promises.push(this.context.emit('data', messages.newMessageWithBody(record)));
        })
        .on('end', function () {
          if (response.totalFetched === 0) {
            promises.push(emit('data', messages.newMessageWithBody({})));
          }
          logger.info('Total in database=%s', response.totalSize);
          logger.info('Total fetched=%s', response.totalFetched);
          resolve();
        })
        .on('error', (err) => {
          logger.error(err);
          promises.push(this.context.emit('error', err));
          reject(err);
        })
        .run({ autoFetch: true, maxFetch: 1000 });
    });
    await Promise.all(promises);
  }
}

class EmitAllHandler {
  constructor(context, message, configuration) {
    this.context = context;
    this.logger = context.logger;
    this.message = message;
    this.connection = getConnection(context, configuration);
    this.configuration = configuration;
  }

  async call() {
    const { logger } = this;
    const { emit } = this.context;
    const result = [];
    await new Promise((resolve, reject) => {
      const response = this.connection.query(this.message.body.query)
        .scanAll(this.configuration.includeDeleted)
        .on('record', (record) => {
          result.push(record);
        })
        .on('end', function () {
          logger.info('Result: %j', result);
          logger.info('Total in database=%s', response.totalSize);
          logger.info('Total fetched=%s', response.totalFetched);
          if (response.totalFetched === 0) {
            resolve(emit('data', messages.newMessageWithBody({})));
          }
          if (result.length > 0) {
            resolve(emit('data', messages.newMessageWithBody({ result })));
          }
        })
        .on('error', (err) => {
          this.logger.error(err);
          reject(this.context.emit('error', err));
        });
    });
  }
}

exports.process = async function processAction(message, configuration) {
  const { logger } = this;
  logger.trace('Input configuration: %j', configuration);
  logger.trace('Input message: %j', message);
  let batchSize = configuration.batchSize || 0;
  if (isNaN(batchSize)) {
    throw new Error("batchSize must be a number");
  }
  let handler;
  if (configuration.allowResultAsSet) {
    logger.info('Selected EmitAllHandler');
    handler = new EmitAllHandler(this, message, configuration);
  } else if (configuration.batchSize > 0) {
    logger.info('Selected EmitBatchHandler');
    handler = new EmitBatchHandler(this, message, configuration);
  } else {
    logger.info('Selected EmitIndividuallyHandler');
    handler = new EmitIndividuallyHandler(this, message, configuration);
  }


  this.logger.info('Starting SOQL Select batchSize=%s query=%s', batchSize, message.body.query);
  await handler.call();
};


