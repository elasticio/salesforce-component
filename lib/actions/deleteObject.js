const { messages } = require('elasticio-node');
const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');
<<<<<<< HEAD
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
=======


exports.objectTypes = function objectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getObjectTypes();
};


exports.process = async function deleteObject(message, configuration) {
  if (!message.body.id || !String(message.body.id).trim()) {
    this.logger.error('Salesforce error. Empty ID');
    return messages.newMessageWithBody({ });
>>>>>>> 865ca3a2219cbc12f479ab30f9a1ac8ea340852f
  }

  this.logger.debug(`Preparing to delete a ${configuration.sobject} object...`);

<<<<<<< HEAD
  const meta = await sfConn.describe(configuration.sobject);
  const field = meta.fields.find(fld => fld.name === lookupField);
  this.logger.info(MetaLoader.TYPES_MAP[field.type]);
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
=======
  let response;
  try {
    const sfConn = sfConnection.createConnection(configuration, this);
    response = await sfConn.sobject(configuration.sobject).delete(message.body.id);
  } catch (err) {
    this.logger.error(`Salesforce error. ${err.message}`);
    return messages.newMessageWithBody({ });
  }

  this.logger.debug(`${configuration.sobject} has been successfully deleted (ID = ${response.id}).`);
  return messages.newMessageWithBody({ result: response });
};
>>>>>>> 865ca3a2219cbc12f479ab30f9a1ac8ea340852f
