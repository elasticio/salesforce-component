const { messages } = require('elasticio-node');
const { callJSForceMethod } = require('../helpers/wrapper');

exports.process = async function processTrigger(msg, configuration) {
  const { query, outputMethod = 'emitIndividually' } = configuration;
  const records = await callJSForceMethod.call(this, configuration, 'queryEmitAll', query);
  if (records.length === 0) {
    await this.emit('data', messages.newEmptyMessage());
  } else if (outputMethod === 'emitAll') {
    this.logger.info('Selected Output method Emit all');
    await this.emit('data', messages.newMessageWithBody({ records }));
  } else if (outputMethod === 'emitIndividually') {
    this.logger.info('Selected Output method Emit individually');
    // eslint-disable-next-line no-restricted-syntax
    for (const record of records) {
      // eslint-disable-next-line no-await-in-loop
      await this.emit('data', messages.newMessageWithBody(record));
    }
  } else {
    throw new Error('Unsupported Output method');
  }
};
