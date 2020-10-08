const { messages } = require('elasticio-node');
const { processMeta } = require('../helpers/utils');
const attachment = require('../helpers/attachment.js');
const { callJSForceMethod } = require('../helpers/wrapper');

exports.objectTypes = async function objectTypes(configuration) {
  return callJSForceMethod.call(this, configuration, 'getCreateableObjectTypes');
};

exports.getMetaModel = async function getMetaModel(configuration) {
  const meta = await callJSForceMethod.call(this, configuration, 'describe');
  return processMeta(meta, 'create');
};

exports.process = async function createObject(message, configuration) {
  this.logger.info('Starting Create Object Action');
  this.logger.debug(`Preparing to create a ${configuration.sobject} object...`);
  const binaryField = await attachment.prepareBinaryData(message, configuration, this);

  this.logger.info('Sending request to SalesForce...');
  const response = await callJSForceMethod.call(this, configuration, 'sobjectCreate', message);

  this.logger.debug(`${configuration.sobject} has been successfully created`);
  this.logger.trace(`${configuration.sobject} has been successfully created (ID = ${response.id}).`);
  // eslint-disable-next-line no-param-reassign
  message.body.id = response.id;

  if (binaryField) {
    // eslint-disable-next-line no-param-reassign
    delete message.body[binaryField.name];
  }

  return messages.newMessageWithBody(message.body);
};
