const { messages } = require('elasticio-node');
const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');
const helpers  = require('../helpers/deleteObjectHelpers.js')
// "test": "eslint & mocha spec --recursive --timeout 50000",
// "integration-test": "mocha spec-integration --recursive --timeout 50000"


/**
 * Des: Taken from lookupObject.js due to overlapping functionality
*/
module.exports.objectTypes = function objectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getSearchableObjectTypes();
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

  this.logger.info(`Heres the ouath ${configuration.oauth.refresh_token} refresh token`);
  this.logger.info(`Heres the ouath ${configuration.oauth.access_token} refresh token`);

  if (!lookupValue) {
    const err = new Error('No unique criteria provided');
    this.logger.error(err);
    this.emit('error', err);
    return;
  }

  this.logger.debug(`Preparing to delete a ${configuration.sobject} object...`);

  const meta = await sfConn.describe(configuration.sobject);
  const field = meta.fields.find(fld => fld.name === lookupField);
  const condition = (['number','date','datetime'].includes(MetaLoader.TYPES_MAP[field.type]))
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

        const err = new Error('No objects found');
        this.logger.error(err);
        this.emit('error', err);

      } else if (res.length === 1) {

        await helpers.deleteObjById.call(this, sfConn, res[0].Id, configuration.sobject);
       
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

/**
 * Des: Taken from lookupObject.js due to overlapping functionality
*/
module.exports.getLookupFieldsModel = function getLookupFieldsModel(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getLookupFieldsModelWithTypeOfSearch(configuration.typeOfSearch);
};