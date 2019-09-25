'use strict';

const _ = require('lodash');
const jsforce = require('jsforce');
const messages = require('elasticio-node').messages;
const debug = require('debug')('salesforce:createObject');
const SalesforceEntity = require('../entry.js').SalesforceEntity;
const MetaLoader = require('../helpers/metaLoader');
const common = require('../common.js');
const attachment = require('../helpers/attachment.js');

exports.objectTypes = async function objectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return await metaLoader.getCreateableObjectTypes();
};

exports.process = async function createObject(msg, configuration) {
  console.log(`Preparing to create a ${configuration.sobject} object...`);

  const sfConn = new jsforce.Connection({
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
  sfConn.on('refresh', (accessToken, res) => {
    console.log('Keys were updated, res=%j', res);
    this.emit('updateKeys', {oauth: res});
  });

  debug("Creating message body: ", msg.body);

  const binaryField = await attachment.prepareBinaryData(msg, configuration, sfConn, this);

  console.log("Sending request to SalesForce...");

  try {
    const response = await sfConn.sobject(configuration.sobject).create(msg.body);

    debug("SF response: ", response);
    console.log(`${configuration.sobject} has been successfully created (ID = ${response.id}).`);
    msg.body.id = response.id;

    if (binaryField)
      delete msg.body[binaryField.name];

    return messages.newMessageWithBody(msg.body);
  } catch (err) {
    this.emit('Error: ', err);
  }
};

exports.getMetaModel = function getMetaModel(cfg, cb) {
  var entity = new SalesforceEntity(this);
  entity.getInMetaModel(cfg, function transformMetadata(err, data) {
    if (err) {
      return cb(err);
    }
    data.out = _.cloneDeep(data.in);
    data.out.properties.id = {
      type: "string",
      required: true,
      readonly: true,
      title: "ObjectID"
    };
    cb(null, data);
  });
};
