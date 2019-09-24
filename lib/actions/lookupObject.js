const jsforce = require('jsforce');
const debug = require('debug')('salesforce:lookup');
const messages = require('elasticio-node').messages;
const MetaLoader = require('../helpers/metaLoader');
const common = require('../common.js');
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
module.exports.getLookupFieldsModel = async function getLookupFieldsModel(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return await metaLoader.getLookupFieldsModelWithTypeOfSearch(configuration.typeOfSearch);
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
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: process.env.SALESFORCE_KEY,
      clientSecret: process.env.SALESFORCE_SECRET,
      redirectUri: 'https://app.elastic.io/oauth/v2',
    },
    instanceUrl: configuration.oauth.instance_url,
    accessToken: configuration.oauth.access_token,
    refreshToken: configuration.oauth.refresh_token,
    version: common.globalConsts.SALESFORCE_API_VERSION,
  });

  conn.on('refresh', (accessToken, res) => {
    console.log('Keys were updated, res=%j', res);
    this.emit('updateKeys', {oauth: res});
  });

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
  await conn.sobject(configuration.sobject)
      .select('*')
      .where(
          `${lookupField} = '${lookupValue}'`)
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
module.exports.objectTypes = async function getObjectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return await metaLoader.getSearchableObjectTypes();
};