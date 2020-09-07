const { messages } = require('elasticio-node');
const { callJSForceMethod } = require('../helpers/wrapper');
const { processMeta } = require('../helpers/utils');
const attachment = require('../helpers/attachment');

/**
 * This function will return a metamodel description for a particular object
 *
 * @param configuration
 */
module.exports.getMetaModel = async function getMetaModel(configuration) {
  const meta = await callJSForceMethod.call(this, configuration, 'describe');
  return processMeta(meta, 'upsert');
};

/**
 * This function will be called to fetch available object types.
 *
 * Note: only updatable and creatable object types are returned here
 *
 * @param configuration
 */
module.exports.objectTypes = async function getObjectTypes(configuration) {
  return callJSForceMethod.call(this, configuration, 'getObjectTypes');
};

/**
 * This function will upsert given object
 *
 * @param message
 * @param configuration
 */
module.exports.process = async function upsertObject(message, configuration) {
  // eslint-disable-next-line no-param-reassign
  configuration.object = configuration.sobject;
  this.logger.info('Starting upsertObject');

  await attachment.prepareBinaryData(message, configuration, this);

  if (message.body.Id) {
    this.logger.info('Upserting sobject=%s by internalId', configuration.sobject, message.body.Id);
    this.logger.debug('Upserting %s by internalId data: %j', configuration.sobject, message.body.Id, message);
    await callJSForceMethod.call(this, configuration, 'sobjectUpdate', message);
    // eslint-disable-next-line no-param-reassign
    configuration.lookupField = 'Id';
    const lookupResults = await callJSForceMethod.call(this, configuration, 'sobjectLookup', { body: { Id: message.body.Id } });
    if (lookupResults.length === 1) {
      this.logger.info('sobject=%s was upserted by internalId=%s', configuration.sobject, message.body.Id);
      this.emit('data', messages.newMessageWithBody(lookupResults[0]));
      return;
    }
    if (lookupResults.length > 1) {
      throw new Error(`Found more than 1 sobject=${configuration.sobject} by internalId=${message.body.Id}`);
    } else {
      throw new Error(`Can't found sobject=${configuration.sobject} by internalId=${message.body.Id}`);
    }
  }

  this.logger.info('Upserting sobject: %s by externalId: %s', configuration.sobject, configuration.extIdField);
  this.logger.debug('Upserting sobject: %s by externalId:%s data: %j', configuration.sobject, configuration.extIdField, message);

  if (!configuration.extIdField) {
    throw Error('Can not find internalId/externalId ids');
  }

  await callJSForceMethod.call(this, configuration, 'sobjectUpsert', message);
  // eslint-disable-next-line no-param-reassign
  configuration.lookupField = configuration.extIdField;
  const lookupResults = await callJSForceMethod.call(this, configuration, 'sobjectLookup', message);
  if (lookupResults.length === 1) {
    this.logger.info('sobject=%s was upserted by externalId=%s', configuration.sobject, configuration.extIdField);
    this.emit('data', messages.newMessageWithBody(lookupResults[0]));
  }
  if (lookupResults.length > 1) {
    throw new Error(`Found more than 1 sobject=${configuration.sobject} by externalId=${configuration.extIdField}`);
  } else {
    throw new Error(`Can't found sobject=${configuration.sobject} by externalId=${configuration.extIdField}`);
  }
};
