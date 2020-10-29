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

// eslint-disable-next-line consistent-return
exports.process = async function createObject(message, configuration) {
  this.logger.info(`Preparing to create a ${configuration.sobject} object...`);

  const sfConn = sfConnection.createConnection(configuration, this);

  this.logger.debug('Creating message body');

  const binaryField = await attachment.prepareBinaryData(message, configuration, sfConn, this);

  this.logger.info('Sending request to SalesForce...');

  try {
    const response = await sfConn.sobject(configuration.sobject).create(message.body);

    this.logger.info(`${configuration.sobject} has been successfully created.`);
    // eslint-disable-next-line no-param-reassign
    message.body.id = response.id;

    if (binaryField) {
      // eslint-disable-next-line no-param-reassign
      delete message.body[binaryField.name];
    }

    return messages.newMessageWithBody(message.body);
  } catch (err) {
    await this.emit('error', err);
  }
};

exports.getMetaModel = function getMetaModel(cfg, cb) {
  const entity = new SalesforceEntity(this);
  entity.getInMetaModel(cfg, (err, data) => {
    if (err) {
      return cb(err);
    }
    // eslint-disable-next-line no-param-reassign
    data.out = _.cloneDeep(data.in);
    // eslint-disable-next-line no-param-reassign
    data.out.properties.id = {
      type: 'string',
      required: true,
      readonly: true,
      title: 'ObjectID',
    };
    return cb(null, data);
  });
};
