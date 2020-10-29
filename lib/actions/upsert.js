const lookup = require('./lookup');
const MetaLoader = require('../helpers/metaLoader');
const attachment = require('../helpers/attachment.js');
const sfConnection = require('../helpers/sfConnection.js');

/**
 * This function will return a metamodel description for a particular object
 *
 * @param configuration
 */
module.exports.getMetaModel = function getMetaModel(configuration) {
  // eslint-disable-next-line no-param-reassign
  configuration.metaType = 'upsert';
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.loadMetadata();
};

/**
 * This function will be called to fetch available object types.
 *
 * Note: only updatable and creatable object types are returned here
 *
 * @param configuration
 */
module.exports.objectTypes = function getObjectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getObjectTypes();
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

  const conn = sfConnection.createConnection(configuration, this);

  await attachment.prepareBinaryData(message, configuration, conn, this);

  if (message.body.Id) {
    this.logger.info('Upserting sobject=%s by internalId', configuration.sobject);
    return conn.sobject(configuration.sobject).update(message.body)
      .then(() => {
        // eslint-disable-next-line no-param-reassign
        configuration.lookupField = 'Id';
        return lookup.process.call(this, { body: { Id: message.body.Id } },
          configuration);
      });
  }

  this.logger.info('Upserting sobject: %s by externalId: %s', configuration.sobject, configuration.extIdField);
  this.logger.debug('Upserting sobject: %s by externalId:%s data: %j', configuration.sobject, configuration.extIdField, message);

  if (!configuration.extIdField) {
    throw Error('Can not find internalId/externalId ids');
  }

  return conn.sobject(configuration.sobject)
    .upsert(message.body, configuration.extIdField)
    .then(() => {
      // eslint-disable-next-line no-param-reassign
      configuration.lookupField = configuration.extIdField;
      return lookup.process.call(this, message, configuration);
    });
};
