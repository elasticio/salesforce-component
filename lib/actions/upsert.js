'use strict';
const jsforce = require('jsforce');
const lookup = require('./lookup');
const debug = require('debug')('Upsert');
const SALESFORCE_API_VERSION = '39.0';
const MetaLoader = require('../helpers/metaLoader');

/**
 * This function will return a metamodel description for a particular object
 *
 * @param configuration
 */
module.exports.getMetaModel = async function getMetaModel(configuration) {
  configuration.metaType = 'upsert';
  const metaLoader = new MetaLoader(configuration);
  return await metaLoader.loadMetadata();
};

/**
 * This function will be called to fetch available object types.
 *
 * Note: only updatable and creatable object types are returned here
 *
 * @param configuration
 */
module.exports.objectTypes = async function getObjectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration);
  return await metaLoader.getObjectTypes();
};

/**
 * This function will upsert given object
 *
 * @param message
 * @param configuration
 */
module.exports.process = function upsertObject(message, configuration) {
  const self = this;
  configuration.object = configuration.sobject;
  console.log('Starting upsertObject');
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

  if (message.body.Id) {
    console.log('Upserting sobject=%s by internalId', configuration.sobject, message.body.Id);
    debug('Upserting %s by internalId data: %j', configuration.sobject, message.body.Id, message);
    return conn.sobject(configuration.sobject).update(message.body)
        .then(() => {
          configuration.lookupField = 'Id';
          return lookup.process.call(self, {body:{Id: message.body.Id}},
              configuration);
        });
  } else {
    console.log('Upserting sobject: %s by externalId: %s',configuration.sobject, configuration.extIdField);
    debug('Upserting sobject: %s by externalId:%s data: %j',configuration.sobject, configuration.extIdField, message);

    if(!configuration.extIdField){
      throw Error('Can not find internalId/externalId ids');
    }

    return conn.sobject(configuration.sobject)
        .upsert(message.body, configuration.extIdField)
        .then(() => {
          configuration.lookupField = configuration.extIdField;
          return lookup.process.call(this, message, configuration);
        });
  }
};
