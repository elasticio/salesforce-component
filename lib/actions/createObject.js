'use strict';

const _ = require('lodash');
const requestPromise = require('request-promise');
const jsforce = require('jsforce');
const messages = require('elasticio-node').messages;
const debug = require('debug')('salesforce:metaLoader');
const SalesforceEntity = require('../entry.js').SalesforceEntity;
const MetaLoader = require('../helpers/metaLoader');
const common = require('../common.js');

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

  let binField;
  let attachment;
  for (attachment in msg.attachments) break;

  if (attachment) {
    attachment = msg.attachments[attachment];
    console.log("Found an attachment from the previous component.");

    const metaLoader = new MetaLoader(configuration, this, sfConn);
    const objectFields = await metaLoader.getObjectFieldsMetaData();

    binField = objectFields.find(field => field.type === "base64");

    if (binField) {
      console.log("Preparing the attachment...");

      const optsDownload = {
        uri: attachment['url'],
        method: 'GET',
        resolveWithFullResponse: true,
        encoding: null
      }
      const response = await requestPromise(optsDownload);
      msg.body[binField.name] = Buffer.from(response.body).toString('base64');

      if (attachment["content-type"] && objectFields.find(field => field.name === "ContentType"))
        msg.body.ContentType = attachment["content-type"];

    } else {
      console.log(`${configuration.sobject} object does not have a field for binary data. The attachment is discarded.`);
    }
  }

  console.log("Sending request to SalesForce...");

  return sfConn.sobject(configuration.sobject).create(msg.body)
    .then((result) => {
      debug("SF response: ", result);
      console.log(`${configuration.sobject} has been successfully created (ID = ${result.id}).`);
      msg.body.id = result.id;
      if (binField.name)
        delete msg.body[binField.name];
      return messages.newMessageWithBody(msg.body);
    })
    .catch(err => this.emit('Error: ', err));
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
