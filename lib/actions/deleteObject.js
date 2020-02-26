/* eslint-disable no-param-reassign,consistent-return */

const { messages } = require('elasticio-node');
const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');
const helpers = require('../helpers/deleteObjectHelpers.js');

/**
 * Des: Taken from lookupObject.js due to overlapping functionality
*/
module.exports.objectTypes = function objectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getObjectTypes();
};

module.exports.getMetaModel = async function getMetaModel(configuration) {
  this.logger.debug(`Get MetaModel is called with config ${JSON.stringify(configuration)}`);
  configuration.metaType = 'lookup';
  const metaLoader = new MetaLoader(configuration, this);
  const metaData = await metaLoader.loadMetadata();
  if (configuration.lookupField) { /* use the new feature */
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
  const res = [];
  const sfConn = sfConnection.createConnection(configuration, this);

  if (!lookupValue) {
    this.logger.trace('No unique criteria provided, run previous functionality');

    if (!message.body.id || !String(message.body.id).trim()) {
      this.logger.error('Salesforce error. Empty ID');
      return messages.newEmptyMessage();
    }

    this.logger.debug(`Preparing to delete a ${configuration.sobject} object...`);

    let response;
    try {
      response = await sfConn.sobject(configuration.sobject).delete(message.body.id);
    } catch (err) {
      this.logger.error(`Salesforce error. ${err.message}`);
      return messages.newEmptyMessage();
    }

    this.logger.debug(`${configuration.sobject} has been successfully deleted (ID = ${response.id}).`);
    return messages.newMessageWithBody({ response });
  }

  this.logger.trace(`Preparing to delete a ${configuration.sobject} object...`);

  const meta = await sfConn.describe(configuration.sobject);
  const field = meta.fields.find(fld => fld.name === lookupField);
  const condition = (['date', 'datetime'].includes(field.type)
    || MetaLoader.TYPES_MAP[field.type] === 'number'
    || MetaLoader.TYPES_MAP[field.type] === 'boolean')
    ? `${lookupField} = ${lookupValue}`
    : `${lookupField} = '${lookupValue}'`;

  await sfConn.sobject(configuration.sobject)
    .select('*')
    .where(condition)
    .on('record', (record) => {
      res.push(record);
    })
    .on('end', async () => {
      if (res.length === 0) {
        this.logger.info('No objects are found');
        await this.emit('data', messages.newEmptyMessage());
      } else if (res.length === 1) {
        await helpers.deleteObjById.call(this, sfConn, res[0].Id, configuration.sobject);
      } else {
        const err = new Error('More than one object found, can only delete 1');
        this.logger.error(err);
        this.logger.trace(`Here are the objects found ${JSON.stringify(res)}`);
        await this.emit('error', err);
      }
    })
    .on('error', async (err) => {
      this.logger.error(err);
      await this.emit('error', err);
    })
    .run({ autoFetch: true, maxFetch: 2 });
};

module.exports.getLookupFieldsModel = function getLookupFieldsModel(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getLookupFieldsModelWithTypeOfSearch(configuration.typeOfSearch);
};
