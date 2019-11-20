const { messages } = require('elasticio-node');
const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');


exports.objectTypes = function objectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getObjectTypes();
};


exports.process = async function deleteObject(message, configuration) {
  if (!message.body.id || !String(message.body.id).trim()) {
    this.logger.error('Salesforce error. Empty ID');
    return messages.newMessageWithBody({ });
  }

  this.logger.debug(`Preparing to delete a ${configuration.sobject} object...`);

  let response;
  try {
    const sfConn = sfConnection.createConnection(configuration, this);
    response = await sfConn.sobject(configuration.sobject).delete(message.body.id);
  } catch (err) {
    this.logger.error(`Salesforce error. ${err.message}`);
    return messages.newMessageWithBody({ });
  }

  this.logger.debug(`${configuration.sobject} has been successfully deleted (ID = ${response.id}).`);
  return messages.newMessageWithBody({ result: response });
};
