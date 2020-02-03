const { messages } = require('elasticio-node');
const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');

// "test": "eslint & mocha spec --recursive --timeout 50000",
// "integration-test": "mocha spec-integration --recursive --timeout 50000"

module.exports.objectTypes = function objectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getSearchableObjectTypes();
};

module.exports.getMetaModel = async function getMetaModel(configuration) {
  configuration.metaType = 'lookup';
  const metaLoader = new MetaLoader(configuration, this);
  const metaData = await metaLoader.loadMetadata();
  metaData.in.properties[configuration.lookupField].required = true;
  return metaData;
};

/**
 * Des: This function will firstly lookup the item, then delete it by id
 * @implementedBy C.J.V
 * @param configuration
 * 
*/
module.exports.process = async function deleteObject(message, configuration) {
  const { lookupField } = configuration;
  const lookupValue = message.body[lookupField];
  const res = [];
  const conn = sfConnection.createConnection(configuration, this);

  if (!lookupValue) {
    const err = new Error('No unique criteria provided');
    this.logger.error(err);
    this.emit('error', err);
    return;
  }

  this.logger.debug(`Preparing to delete a ${configuration.sobject} object...`);

  const meta = await conn.describe(configuration.sobject);
  const field = meta.fields.find(fld => fld.name === lookupField);
  const condition = (MetaLoader.TYPES_MAP[field.type] === 'number')
    ? `${lookupField} = ${lookupValue}`
    : `${lookupField} = '${lookupValue}'`;

  await conn.sobject(configuration.sobject)
    .select('*')
    .where(condition)
    .on('record', (record) => {
      res.push(record);
    })
    .on('end', async () => {
      if (res.length === 0) {
          const err = new Error('No objects found');
          this.logger.error(err);
          this.emit('error', err);
      } else if (res.length === 1) {
        try {
          this.logger.info(`Here's the ID of what we're deleting ${res[0].Id}`);
          let deleteRes = await conn.sobject(configuration.sobject).delete(res[0].Id);

          this.logger.info(`Sucessfully deleted object ${res[0].Id}`);
          const outputMessage = messages.newMessageWithBody(deleteRes);
          this.emit('data', outputMessage);

        } catch (err) {
            this.logger.error(`Salesforce error. ${err.message}`);
            return messages.newMessageWithBody({ });
        }
      } else {
        const err = new Error('More than one object found, can only delete 1');
        this.logger.error(err);
        this.logger.info(`Here are the objects found ${JSON.stringify(res)}`);
        this.emit('error', err);
      }
    })
    .on('error', (err) => {
      this.logger.error(err);
      this.emit('error', err);
    })
    .run({ autoFetch: true, maxFetch: 2 });
};

module.exports.getLookupFieldsModel = function getLookupFieldsModel(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getLookupFieldsModelWithTypeOfSearch(configuration.typeOfSearch);
};

