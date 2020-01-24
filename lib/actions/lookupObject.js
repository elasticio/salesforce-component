const { messages } = require('elasticio-node');
const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');
const attachmentTools = require('../helpers/attachment.js');
const { lookupCache } = require('../helpers/lookupCache.js');

/**
 * This function will return a metamodel description for a particular object
 *
 * @param configuration
 */
module.exports.getMetaModel = async function getMetaModel(configuration) {
  configuration.metaType = 'lookup';
  const metaLoader = new MetaLoader(configuration, this);
  const metaData = await metaLoader.loadMetadata();
  metaData.in.properties[configuration.lookupField].required = !configuration.allowCriteriaToBeOmitted;
  return metaData;
};

/**
 * This function will return a metamodel description for a particular object
 *
 * @param configuration
 */
module.exports.getLookupFieldsModel = function getLookupFieldsModel(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getLookupFieldsModelWithTypeOfSearch(configuration.typeOfSearch);
};

/**
 * This function will process Action
 *
 * @param message - contains data for processing
 * @param configuration - contains configuration data for processing
 */
module.exports.process = async function processAction(message, configuration) {
  const { allowCriteriaToBeOmitted, allowZeroResults, lookupField } = configuration;
  const lookupValue = message.body[lookupField];
  const res = [];
  const conn = sfConnection.createConnection(configuration, this);

  if (!lookupValue) {
    if (allowCriteriaToBeOmitted) {
      this.emit('data', messages.newMessageWithBody({}));
      return;
    }
    const err = new Error('No unique criteria provided');
    this.logger.error(err);
    this.emit('error', err);
    return;
  }

  const meta = await conn.describe(configuration.sobject);
  const field = meta.fields.find(fld => fld.name === lookupField);
  const condition = (MetaLoader.TYPES_MAP[field.type] === 'number')
    ? `${lookupField} = ${lookupValue}`
    : `${lookupField} = '${lookupValue}'`;

  const queryKey = lookupCache.generateKeyFromDataArray(condition);
  if (lookupCache.hasKey(queryKey)) {
    this.logger.info('Cached response found!');
    const response = lookupCache.getResponse(queryKey);
    return this.emit('data', messages.newMessageWithBody(response));
  }

  const query = conn.sobject(configuration.sobject)
    .select('*')
    .where(condition)
    .on('error', (err) => {
      this.logger.error(err);
      this.emit('error', err);
    });

  query.on('record', (record) => {
    res.push(record);
  });

  query.on('end', async () => {
    if (res.length === 0) {
      if (allowZeroResults) {
        lookupCache.addRequestResponsePair(queryKey, {});
        this.emit('data', messages.newMessageWithBody({}));
      } else {
        const err = new Error('No objects found');
        this.logger.error(err);
        this.emit('error', err);
      }
    } else if (res.length === 1) {
      try {
        const outputMessage = messages.newMessageWithBody(res[0]);

        if (configuration.passBinaryData) {
          const attachment = await attachmentTools.getAttachment(configuration, res[0], conn, this);
          if (attachment) {
            outputMessage.attachments = attachment;
          }
        }

        lookupCache.addRequestResponsePair(queryKey, res[0]);
        this.logger.debug('emitting record %j', outputMessage);
        this.emit('data', outputMessage);
      }
      catch (err) {
        this.logger.error(err);
        this.emit('error', err);
      }
    } else {
      const err = new Error('More than one object found');
      this.logger.error(err);
      this.emit('error', err);
    }
  });

  await query.execute({ autoFetch: true, maxFetch: 2 });
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
  return metaLoader.getSearchableObjectTypes();
};
