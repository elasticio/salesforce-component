const { messages } = require('elasticio-node');
const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');
const helpers = require('../helpers/deleteObjectHelpers.js')

/**
 * Des: Taken from lookupObject.js due to overlapping functionality
*/
module.exports.objectTypes = function objectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getObjectTypes();
};

/**
 * Des: Taken from lookupObject.js due to overlapping functionality
*/
module.exports.getMetaModel = async function getMetaModel(configuration) {
  configuration.metaType = 'lookup';
  const metaLoader = new MetaLoader(configuration, this);
  const metaData = await metaLoader.loadMetadata();
  metaData.in.properties[configuration.lookupField].required = true;
  return metaData;
};

/**
 * Des: 
 * - This function will firstly lookup the object based on fields
 * in the metaData
 * - Emits an error if zero or more than one object is found and returns false
 * - If delete was sucessful
 * @implementedBy C.J.V
 * @param configuration encapsulates the lookup value and lookup key
*/
module.exports.process = async function process(message, configuration) {
  const { lookupField } = configuration;
  const lookupValue = message.body[lookupField];
  const res = [];
  const sfConn = sfConnection.createConnection(configuration, this);

  if (!lookupValue) {
    throw Error('No unique criteria provided');
  }

  this.logger.trace(`Preparing to delete a ${configuration.sobject} object...`);

  const meta = await sfConn.describe(configuration.sobject);
  const field = meta.fields.find(fld => fld.name === lookupField);
  const condition = (['date','datetime'].includes(field.type) || MetaLoader.TYPES_MAP[field.type] === 'number')
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

/**
 * Des: Taken from lookupObject.js due to overlapping functionality
*/
module.exports.getLookupFieldsModel = function getLookupFieldsModel(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getLookupFieldsModelWithTypeOfSearch(configuration.typeOfSearch);
};
