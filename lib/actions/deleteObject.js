const { messages } = require('elasticio-node');
const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');

// "test": "eslint & mocha spec --recursive --timeout 50000",
// "integration-test": "mocha spec-integration --recursive --timeout 50000"

exports.objectTypes = function objectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getSearchableObjectTypes();
};

exports.process = async function deleteObject(message, configuration) {
  const { allowCriteriaToBeOmitted, allowZeroResults, lookupField } = configuration;
  const lookupValue = message.body[lookupField];
  const res = [];

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

  // if (!message.body.id || !String(message.body.id).trim()) {
  //   this.logger.error('Salesforce error. Empty ID');
  //   return messages.newMessageWithBody({ });
  // }

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

          const sfConn = sfConnection.createConnection(configuration, this);
          this.logger.info(`Let's examine the response from the server ${JSON.stringify(res)}`);
          response = await sfConn.sobject(configuration.sobject).delete(res[0].id);

          this.logger.debug(`${configuration.sobject} has been successfully deleted (ID = ${response.id}).`);
          const outputMessage = messages.newMessageWithBody(res[0]);

          // if (configuration.passBinaryData) {
          //   const attachment = await attachmentTools.getAttachment(configuration, res[0], conn, this);
          //   if (attachment) {
          //     outputMessage.attachments = attachment;
          //   }
          // }

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