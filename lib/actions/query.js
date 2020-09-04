/* eslint-disable no-await-in-loop */
const { messages } = require('elasticio-node');
const { callJSForceMethod } = require('../helpers/wrapper');

exports.process = async function processAction(message, configuration) {
  const { logger } = this;
  logger.trace('Input configuration: %j', configuration);
  logger.trace('Input message: %j', message);
  const batchSize = configuration.batchSize || 0;
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(batchSize)) {
    throw new Error('batchSize must be a number');
  }
  const { query } = message.body;
  logger.info('Starting SOQL Select batchSize=%s query=%s', batchSize, query);
  if (configuration.allowResultAsSet) {
    logger.info('Selected EmitAllHandler');
    const result = await callJSForceMethod.call(this, configuration, 'queryEmitAll', query);
    if (result.length === 0) {
      await this.emit('data', messages.newEmptyMessage());
    } else {
      await this.emit('data', messages.newMessageWithBody({ result }));
    }
    return;
  }
  if (configuration.batchSize > 0) {
    logger.info('Selected EmitBatchHandler');
    const results = await callJSForceMethod.call(this, configuration, 'queryEmitBatch', query);
    if (results.length === 0) {
      await this.emit('data', messages.newEmptyMessage());
    } else {
      // eslint-disable-next-line no-restricted-syntax
      for (const result of results) {
        await this.emit('data', messages.newMessageWithBody({ result }));
      }
    }
  } else {
    logger.info('Selected EmitIndividuallyHandler');
    const results = await callJSForceMethod.call(this, configuration, 'queryEmitIndividually', query);
    if (results.length === 0) {
      await this.emit('data', messages.newEmptyMessage());
    } else {
      // eslint-disable-next-line no-restricted-syntax
      for (const result of results) {
        await this.emit('data', messages.newMessageWithBody(result));
      }
    }
  }
};
