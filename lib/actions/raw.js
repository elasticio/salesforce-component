/* eslint-disable no-await-in-loop */
const { messages } = require('elasticio-node');
const { callJSForceMethod } = require('../helpers/wrapper');

exports.process = async function process(message, configuration) {
  this.logger.info('Incoming configuration: %j', configuration);
  const result = await callJSForceMethod.call(this, configuration, 'describeGlobal');
  return messages.newMessageWithBody(result);
};
