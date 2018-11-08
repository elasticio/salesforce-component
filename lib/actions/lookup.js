const jsforce = require('jsforce');
const messages = require('elasticio-node').messages;
const describe = require('../helpers/describe');
const converter = require('../helpers/metadata');
const MetaLoader = require('../helpers/metaLoader');
const SALESFORCE_API_VERSION = '39.0';

/**
 * This function will return a metamodel description for a particular object
 *
 * @param cfg
 */
async function getMetaModel(configuration) {
  console.log('Connecting to Salesforce');
  configuration.metaType = 'lookup';
  const metaLoader = new MetaLoader(configuration);
  const result = await metaLoader.loadMetadata();
  return result;
};

/**
 * This function will return a metamodel description for a particular object
 *
 * @param cfg
 */
module.exports.getLookupFieldsModel = function getLookupFieldsModel(configuration) {
  const metaLoader = new MetaLoader(configuration);
  return metaLoader.getLookupFieldsModel();
};

/**
 * See list on https://na45.salesforce.com/services/data/
 * @type {string}
 */
module.exports.process = async function processAction(msg, configuration) {
  const batchSize = configuration.batchSize||0;
  let result = [];
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
  return conn.query(query)
      .on('record', (record) => {
        console.log('batchSize', batchSize);
        if (batchSize > 0) {
          result.push(record);
          if (result.length >= batchSize) {
            console.log('emitting data... ', JSON.stringify({result}));
            this.emit('data', messages.newMessageWithBody({result}));
            result = [];
          }
        } else {
          this.emit('data', messages.newMessageWithBody(record));
        }
      })
      .on('end', () => {
        if (batchSize > 0 &&  result.length>0) {
          this.emit('data', messages.newMessageWithBody({result}));
        }
      })
      .on('error', (err) => {
        console.error(err);
        this.emit('error', err);
      })
      .run({autoFetch: true, maxFetch: 1000});
};

module.exports.getMetaModel = getMetaModel;
/**
 * This function will be called to fetch available object types.
 *
 * Note: only updatable and creatable object types are returned here
 *
 * @param cfg
 */
module.exports.objectTypes = function getObjectTypes(cfg) {
  console.log('Connecting to Salesforce');
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: process.env.SALESFORCE_KEY,
      clientSecret: process.env.SALESFORCE_SECRET,
      redirectUri: 'https://app.elastic.io/oauth/v2',
    },
    instanceUrl: cfg.oauth.instance_url,
    accessToken: cfg.oauth.access_token,
    refreshToken: cfg.oauth.refresh_token,
    version: SALESFORCE_API_VERSION,
  });
  conn.on('refresh', (accessToken, res) => {
    console.log('Keys were updated, res=%j', res);
    this.emit('updateKeys', {oauth: res});
  });
  conn.on('error', err => this.emit('error', err));
  console.log('Fetching sobjects list');
  return conn.describeGlobal().then((response) => {
    const result = {};
    response.sobjects.filter((object) => object.updateable && object.createable)
        .forEach((object) => {
          result[object.name] = object.label;
        });
    console.log('Found %s objects', Object.keys(result).length);
    return result;
  });
};


