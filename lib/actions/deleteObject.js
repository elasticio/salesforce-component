/* eslint-disable no-param-reassign,consistent-return */

const { messages } = require('elasticio-node');
const { callJSForceMethod } = require('../helpers/wrapper');
const { processMeta, getLookupFieldsModelWithTypeOfSearch, TYPES_MAP } = require('../helpers/utils');

module.exports.objectTypes = async function objectTypes(configuration) {
  return callJSForceMethod.call(this, configuration, 'getObjectTypes');
};

module.exports.getLookupFieldsModel = async function getLookupFieldsModel(configuration) {
  const meta = await callJSForceMethod.call(this, configuration, 'describe');
  return getLookupFieldsModelWithTypeOfSearch(meta, configuration.typeOfSearch);
};

module.exports.getMetaModel = async function getMetaModel(configuration) {
  const meta = await callJSForceMethod.call(this, configuration, 'describe');
  let metaData = {
    in: {
      properties: {},
    },
    out: {
      properties: {},
    },
  };
  if (configuration.lookupField) {
    metaData = await processMeta(meta, 'lookup', configuration.lookupField);
    metaData.in.properties[configuration.lookupField].required = true;
  } else {
    metaData.in.properties = {
      id: {
        title: 'Object ID',
        type: 'string',
        required: true,
      },
    };
    metaData.out.properties = {
      result: {
        title: 'name',
        type: 'object',
        properties: {
          id: {
            title: 'id',
            type: 'string',
          },
          success: {
            title: 'success',
            type: 'boolean',
          },
          errors: {
            title: 'errors',
            type: 'array',
          },
        },
      },
    };
  }
  return metaData;
};

module.exports.process = async function process(message, configuration) {
  const { lookupField } = configuration;
  const lookupValue = message.body[lookupField];
  let Id;

  if (!lookupValue) {
    this.logger.trace('No unique criteria provided, run previous functionality');

    if (!message.body.id || !String(message.body.id).trim()) {
      this.logger.error('Salesforce error. Empty ID');
      return messages.newEmptyMessage();
    }
    Id = message.body.id;
  } else {
    this.logger.trace(`Preparing to delete a ${configuration.sobject} object...`);

    const meta = await callJSForceMethod.call(this, configuration, 'describe');
    const field = meta.fields.find(fld => fld.name === lookupField);
    const condition = (['date', 'datetime'].includes(field.type)
        || TYPES_MAP[field.type] === 'number'
        || TYPES_MAP[field.type] === 'boolean')
      ? `${lookupField} = ${lookupValue}`
      : `${lookupField} = '${lookupValue}'`;


    const results = await callJSForceMethod.call(this, configuration, 'selectQuery', { condition });
    if (results.length === 1) {
      // eslint-disable-next-line prefer-destructuring
      Id = results[0].Id;
    } else {
      if (results.length === 0) {
        this.logger.info('No objects are found');
        return this.emit('data', messages.newEmptyMessage());
      }
      const err = new Error('More than one object found, can only delete 1');
      this.logger.error(err);
      this.logger.trace(`Here are the objects found ${JSON.stringify(results)}`);
      return this.emit('error', err);
    }
  }
  this.logger.debug(`Preparing to delete a ${configuration.sobject} object...`);

  let response;
  try {
    response = await callJSForceMethod.call(this, configuration, 'sobjectDelete', { id: Id });
  } catch (err) {
    this.logger.error(`Salesforce error. ${err.message}`);
    return messages.newEmptyMessage();
  }

  this.logger.debug(`${configuration.sobject} has been successfully deleted (ID = ${response.id}).`);
  return messages.newMessageWithBody({ response });
};
