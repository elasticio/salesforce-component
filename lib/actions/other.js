var entry = require('../entry.js');
var _ = require('lodash');
var SalesforceEntity = entry.SalesforceEntity;

exports.objectTypes = function objectTypes(conf, next) {
    var entity = new SalesforceEntity(this);
    entity.listObjectTypes(conf, next);
};

exports.process = function process(msg, conf, next, snapshot) {
    var entity = new SalesforceEntity(this);
    entity.processAction(conf.object, msg, conf, next);
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