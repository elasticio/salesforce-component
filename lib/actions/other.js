var entry = require('../entry.js');
var SalesforceEntity = entry.SalesforceEntity;

exports.objectTypes = function (conf, next) {
    var entity = new SalesforceEntity(this);
    entity.objectTypes(conf, next);
};

exports.process = function (msg, conf, next, snapshot) {
    var entity = new SalesforceEntity(this);
    entity.processAction(conf.object, msg, conf, next);
};

exports.getMetaModel = function (cfg, cb) {
    var entity = new SalesforceEntity(this);
    entity.getInMetaModel(cfg, cb);
};


