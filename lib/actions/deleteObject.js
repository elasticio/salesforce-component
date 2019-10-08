'use strict';

const messages = require('elasticio-node').messages;
const debug = require('debug')('salesforce:deleteObject');
const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');


exports.objectTypes = function objectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getObjectTypes();
};


exports.process = async function deleteObject(message, configuration) {
  debug(`Preparing to delete a ${configuration.sobject} object...`);

  const sfConn = sfConnection.createConnection(configuration, this);
  const response = await sfConn.sobject(configuration.sobject).delete(message.body.id);

  debug(`${configuration.sobject} has been successfully deleted (ID = ${response.id}).`);

  return messages.newMessageWithBody({ response });
};

