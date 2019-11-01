const debug = require('debug')('salesforce:lookup');
const messages = require('elasticio-node').messages;
const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');
const attachmentTools = require('../helpers/attachment.js');

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
  let res = [];
  const conn = sfConnection.createConnection(configuration, this);

  if (!lookupValue){
    if(allowCriteriaToBeOmitted) {
      this.emit('data', messages.newMessageWithBody({}));
      return;
    } else {
      const err = new Error('No unique criteria provided');
      console.error(err);
      this.emit('error', err);
      return;
    }
  }

  const meta = await conn.describe(configuration.sobject);
  const field = meta.fields.find(field => field.name === lookupField);
  const condition = (MetaLoader.TYPES_MAP[field.type] === 'number') ?
    `${lookupField} = ${lookupValue}` :
    `${lookupField} = '${lookupValue}'`;

  await conn.sobject(configuration.sobject)
      .select('*')
      .where(condition)
      .on('record', (record) => {
        res.push(record);
      })
      .on('end', async () => {
        if (res.length === 0) {
          if (allowZeroResults){
            this.emit('data', messages.newMessageWithBody({}));
          } else {
            const err = new Error('No objects found');
            console.error(err);
            this.emit('error', err);
          }
        } else if (res.length === 1) {
          try {
            const outputMessage = messages.newMessageWithBody(res[0]);

            if (configuration.passBinaryData) {
              const attachment = await attachmentTools.getAttachment(configuration, res[0], conn, this);
              if (attachment)
                outputMessage.attachments = attachment;
            }

            debug('emitting record %j', outputMessage);
            this.emit('data', outputMessage);
          } catch (err) {
            console.error(err);
            this.emit('error', err);
          }
        } else {
          const err = new Error('More than one object found');
          console.error(err);
          this.emit('error', err);
        }
      })
      .on('error', (err) => {
        console.error(err);
        this.emit('error', err);
      })
      .execute({ autoFetch : true, maxFetch : 2 });
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