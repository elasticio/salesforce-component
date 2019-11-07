const { messages } = require('elasticio-node');
const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');


exports.objectTypes = function objectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getObjectTypes();
};


exports.process = async function deleteObject(message, configuration) {
  this.logger.debug(`Preparing to delete a ${configuration.sobject} object...`);

  const sfConn = sfConnection.createConnection(configuration, this);
  const response = await sfConn.sobject(configuration.sobject).delete(message.body.id);

  this.logger.debug(`${configuration.sobject} has been successfully deleted (ID = ${response.id}).`);

  return messages.newMessageWithBody({ result: response });
};
