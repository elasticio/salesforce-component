const _ = require('lodash');
const entry = require('../entry.js');

const { SalesforceEntity } = entry;

exports.objectTypes = function objectTypes(conf, next) {
  const entity = new SalesforceEntity(this);
  entity.listObjectTypes(conf, next);
};

exports.process = function process(msg, conf, next, snapshot) {
  const entity = new SalesforceEntity(this);
  entity.processAction(conf.object, msg, conf, next);
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
