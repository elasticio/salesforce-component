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
  metaData.in.properties[configuration.lookupField].required = !configuration.allowCriteriaToBeOmitted;
  return metaData;
};

module.exports.process = async function deleteObject(message, configuration) {
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

  this.logger.debug(`Preparing to delete a ${configuration.sobject} object...`);

  const meta = await conn.describe(configuration.sobject);
  const field = meta.fields.find(fld => fld.name === lookupField);
  const condition = (MetaLoader.TYPES_MAP[field.type] === 'number')
    ? `${lookupField} = ${lookupValue}`
    : `${lookupField} = '${lookupValue}'`;

  // let response;
  // try {
  //   const sfConn = sfConnection.createConnection(configuration, this);
  //   response = await sfConn.sobject(configuration.sobject).delete(message.body.id);
  // } catch (err) {
  //   this.logger.error(`Salesforce error. ${err.message}`);
  //   return messages.newMessageWithBody({ });
  // }

  // this.logger.debug(`${configuration.sobject} has been successfully deleted (ID = ${response.id}).`);
  // return messages.newMessageWithBody({ result: response });

  await conn.sobject(configuration.sobject)
    .select('*')
    .where(condition)
    .on('record', (record) => {
      res.push(record);
    })
    .on('end', async () => {
      if (res.length === 0) {
        if (allowZeroResults) {
          this.emit('data', messages.newMessageWithBody({}));
        } else {
          const err = new Error('No objects found');
          this.logger.error(err);
          this.emit('error', err);
        }
      } else if (res.length === 1) {
        try {
          this.logger.info(`Here's the result ${res}`);
          let deleteRes = await conn.sobject(configuration.sobject).delete(res[0].id);
          this.logger.info(`Let's examine the response from the server ${JSON.stringify(deleteRes)}`);

          this.logger.debug(`${configuration.sobject} has been successfully deleted (ID = ${deleteRes.id}).`);
          const outputMessage = messages.newMessageWithBody(deleteRes);

          this.logger.debug('emitting record %j', outputMessage);
          this.emit('data', outputMessage);

        } catch (err) {
            this.logger.error(`Salesforce error. ${err.message}`);
            return messages.newMessageWithBody({ });
        }
      } else {
        const err = new Error('More than one object found');
        this.logger.error(err);
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
 * This function will return a metamodel description for a particular object
 * @implementedBy C.J.V
 * @param configuration
 * 
 */
module.exports.getLookupFieldsModel = function getLookupFieldsModel(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getLookupFieldsModelWithTypeOfSearch(configuration.typeOfSearch);
};