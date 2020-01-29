const _ = require('lodash');
const { messages } = require('elasticio-node');
const { SalesforceEntity } = require('../entry.js');
const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');
const attachment = require('../helpers/attachment.js');

exports.objectTypes = function objectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getCreateableObjectTypes();
};

exports.process = async function createObject(message, configuration) {
  this.logger.info(`Preparing to create a ${configuration.sobject} object...`);

  const sfConn = sfConnection.createConnection(configuration, this);

  this.logger.debug('Creating message body: ', message.body);

  const binaryField = await attachment.prepareBinaryData(message, configuration, sfConn, this);

  this.logger.info('Sending request to SalesForce...');

  try {
    const response = await sfConn.sobject(configuration.sobject).create(message.body);

    this.logger.debug('SF response: ', response);
    this.logger.info(`${configuration.sobject} has been successfully created (ID = ${response.id}).`);
    message.body.id = response.id;

    if (binaryField) {
      delete message.body[binaryField.name];
    }

    return messages.newMessageWithBody(message.body);
  } catch (err) {
    this.emit('error', err);
  }
};

exports.getMetaModel = function getMetaModel(cfg, cb) {
  const entity = new SalesforceEntity(this);
  entity.getInMetaModel(cfg, (err, data) => {
    if (err) {
      return cb(err);
    }
    data.out = _.cloneDeep(data.in);
    data.out.properties.id = {
      type: 'string',
      required: true,
      readonly: true,
      title: 'ObjectID',
    };
    cb(null, data);
  });
};
