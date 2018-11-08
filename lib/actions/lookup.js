const jsforce = require('jsforce');
const messages = require('elasticio-node').messages;
const MetaLoader = require('../helpers/metaLoader');
const SALESFORCE_API_VERSION = '39.0';

/**
 * This function will return a metamodel description for a particular object
 *
 * @param cfg
 */
module.exports.getMetaModel = async function getMetaModel(configuration) {
  console.log('Connecting to Salesforce');
  configuration.metaType = 'lookup';
  const metaLoader = new MetaLoader(configuration);
  return await metaLoader.loadMetadata();
};

/**
 * This function will return a metamodel description for a particular object
 *
 * @param cfg
 */
module.exports.getLookupFieldsModel = async function getLookupFieldsModel(configuration) {
  const metaLoader = new MetaLoader(configuration);
  return await metaLoader.getLookupFieldsModel();
};

/**
 * See list on https://na45.salesforce.com/services/data/
 * @type {string}
 */
module.exports.process = async function processAction(msg, configuration) {
  const batchSize = configuration.batchSize || 0;
  console.log('batchSize', batchSize);
  let res = [];
  const metaLoader = new MetaLoader(configuration);
  let query = await metaLoader.loadSOQLRequest();

  const conn = new jsforce.Connection({
    oauth2: {
      clientId: process.env.SALESFORCE_KEY,
      clientSecret: process.env.SALESFORCE_SECRET,
      redirectUri: 'https://app.elastic.io/oauth/v2',
    },
    instanceUrl: configuration.oauth.instance_url,
    accessToken: configuration.oauth.access_token,
    refreshToken: configuration.oauth.refresh_token,
    version: SALESFORCE_API_VERSION,
  });

  conn.on('refresh', (accessToken, res) => {
    console.log('Keys were updated, res=%j', res);
    this.emit('updateKeys', {oauth: res});
  });

  query = `${query} WHERE ${configuration.lookupField} = '${msg.body[configuration.lookupField]}'`;
  console.log('Starting SOQL query: %s', query);
  await conn.query(query)
      .on('record', (record) => {
        res.push(record);
      })
      .on('end', () => {
        if(!res.length){
          this.emit('data', messages.newMessageWithBody({}));
        }
        if (batchSize > 0) {
          while (res.length) {
            const result = res.splice(0, batchSize);
            this.emit('data', messages.newMessageWithBody({result}));
          }
        } else {
          res.forEach(record => {
            this.emit('data', messages.newMessageWithBody(record));
          });
        }
      })
      .on('error', (err) => {
        console.error(err);
        this.emit('error', err);
      })
      .run({autoFetch: true, maxFetch: 1000});
};

/**
 * This function will be called to fetch available object types.
 *
 * Note: only updatable and creatable object types are returned here
 *
 * @param cfg
 */
module.exports.objectTypes = async function getObjectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration);
  return await metaLoader.getObjectTypes();
};