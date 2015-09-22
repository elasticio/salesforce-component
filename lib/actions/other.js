var entry = require('../entry.js');
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
    entity.getInMetaModel(cfg, cb);
};