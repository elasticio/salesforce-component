const jsforce = require('jsforce');
const { messages } = require('elasticio-node');
const MetaLoader = require('../helpers/metaLoader');
const common = require('../common.js');

/**
 * This function will return a metamodel description for a particular object
 *
 * @param configuration
 */
module.exports.getMetaModel = async function getMetaModel(configuration) {
  // eslint-disable-next-line no-param-reassign
  configuration.metaType = 'lookup';
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.loadMetadata();
};

/**
 * This function will return a metamodel description for a particular object
 *
 * @param configuration
 */
module.exports.getLookupFieldsModel = async function getLookupFieldsModel(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getLookupFieldsModel();
};

/**
 * See list on https://na45.salesforce.com/services/data/
 * @type {string}
 */
module.exports.process = async function processAction(message, configuration) {
  const batchSize = configuration.batchSize || 0;
  this.logger.debug('batchSize', batchSize);
  const res = [];
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
    },
    instanceUrl: configuration.oauth.instance_url,
    accessToken: configuration.oauth.access_token,
    refreshToken: configuration.oauth.refresh_token,
    version: common.globalConsts.SALESFORCE_API_VERSION,
  });

  conn.on('refresh', (accessToken, refreshResult) => {
    this.logger.trace('Keys were updated');
    this.emit('updateKeys', { oauth: refreshResult });
  });

  const maxFetch = configuration.maxFetch || 1000;

  await conn.sobject(configuration.sobject)
    .select('*')
    .where(`${configuration.lookupField} = '${message.body[configuration.lookupField]}'`)
    .on('record', (record) => {
      res.push(record);
    })
    .on('end', () => {
      if (!res.length) {
        this.emit('data', messages.newMessageWithBody({}));
      }
      if (batchSize > 0) {
        while (res.length) {
          const result = res.splice(0, batchSize);
          this.logger.debug('emitting batch');
          this.emit('data', messages.newMessageWithBody({ result }));
        }
      } else {
        res.forEach((record) => {
          this.logger.debug('emitting record');
          this.emit('data', messages.newMessageWithBody(record));
        });
      }
    })
    .on('error', (err) => {
      this.logger.error('Lookup failed');
      this.emit('error', err);
    })
    .execute({ autoFetch: true, maxFetch });
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
  return metaLoader.getObjectTypes();
};
