const { messages } = require('elasticio-node');
const attachmentTools = require('../helpers/attachment.js');
const { lookupCache } = require('../helpers/lookupCache.js');
const {
  processMeta, getLookupFieldsModelWithTypeOfSearch, getLinkedObjectTypes, TYPES_MAP,
} = require('../helpers/utils');
const { callJSForceMethod } = require('../helpers/wrapper');

/**
 * This function will return a metamodel description for a particular object
 *
 * @param configuration
 */
module.exports.getMetaModel = async function getMetaModel(configuration) {
  const meta = await callJSForceMethod.call(this, configuration, 'describe');
  const metaData = await processMeta(meta, 'lookup', configuration.lookupField);
  metaData.in.properties[configuration.lookupField].required = !configuration.allowCriteriaToBeOmitted;
  return metaData;
};

/**
 * This function will return a metamodel description for a particular object
 *
 * @param configuration
 */
module.exports.getLookupFieldsModel = async function getLookupFieldsModel(configuration) {
  const meta = await callJSForceMethod.call(this, configuration, 'describe');
  return getLookupFieldsModelWithTypeOfSearch(meta, configuration.typeOfSearch);
};

/**
 * This function will return a metamodel description for a particular object
 *
 * @param configuration
 */
module.exports.getLinkedObjectsModel = async function getLinkedObjectsModel(configuration) {
  const meta = await callJSForceMethod.call(this, configuration, 'describe');
  return getLinkedObjectTypes(meta);
};

/**
 * This function will be called to fetch available object types.
 *
 * Note: only updatable and creatable object types are returned here
 *
 * @param configuration
 */
module.exports.objectTypes = async function getObjectTypes(configuration) {
  return callJSForceMethod.call(this, configuration, 'getSearchableObjectTypes');
};

/**
 * This function will process Action
 *
 * @param message - contains data for processing
 * @param configuration - contains configuration data for processing
 */
module.exports.process = async function processAction(message, configuration) {
  const {
    allowCriteriaToBeOmitted,
    allowZeroResults,
    lookupField,
    linkedObjects = [],
  } = configuration;
  const lookupValue = message.body[lookupField];

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

  const meta = await callJSForceMethod.call(this, configuration, 'describe');
  const field = meta.fields.find((fld) => fld.name === lookupField);
  const whereCondition = (['date', 'datetime'].includes(field.type) || TYPES_MAP[field.type] === 'number')
    ? `${lookupField} = ${lookupValue}`
    : `${lookupField} = '${lookupValue}'`;

  lookupCache.useCache(configuration.enableCacheUsage);
  const queryKey = lookupCache.generateKeyFromDataArray(configuration.sobject, whereCondition);
  this.logger.trace(`Current request key hash: "${queryKey}"`);
  if (lookupCache.hasKey(queryKey)) {
    this.logger.info('Cached response found!');
    const response = lookupCache.getResponse(queryKey);
    // eslint-disable-next-line consistent-return
    return this.emit('data', messages.newMessageWithBody(response));
  }

  // the query for the object and all its linked parent objects
  let selectedObjects = '*';
  selectedObjects += linkedObjects.reduce((query, obj) => {
    if (!obj.startsWith('!')) return `${query}, ${obj}.*`;
    return query;
  }, '');

  const queryOptions = {
    selectedObjects, linkedObjects, whereCondition, maxFetch: 2,
  };
  const records = await callJSForceMethod.call(this, configuration, 'pollingSelectQuery', queryOptions);

  if (records.length === 0) {
    if (allowZeroResults) {
      lookupCache.addRequestResponsePair(queryKey, {});
      this.emit('data', messages.newMessageWithBody({}));
    } else {
      const err = new Error('No objects found');
      this.logger.error(err);
      this.emit('error', err);
    }
  } else if (records.length === 1) {
    try {
      const outputMessage = messages.newMessageWithBody(records[0]);

      if (configuration.passBinaryData) {
        const attachment = await attachmentTools.getAttachment(configuration, records[0], this);
        if (attachment) {
          outputMessage.attachments = attachment;
        }
      }

      lookupCache.addRequestResponsePair(queryKey, records[0]);
      this.logger.debug('emitting record %j', outputMessage);
      this.emit('data', outputMessage);
    } catch (err) {
      this.logger.error(err);
      this.emit('error', err);
    }
  } else {
    const err = new Error('More than one object found');
    this.logger.error(err);
    this.emit('error', err);
  }
};
