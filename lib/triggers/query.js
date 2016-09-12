"use strict";

var entry = require('../entry.js');
var SalesforceEntity = require('../entry.js').SalesforceEntity;

exports.process = function processTrigger(msg, conf, snapshot) {
    var entity = new SalesforceEntity(this);
    return entity.processQueryTrigger(msg, conf, snapshot);
};

exports.getMetaModel = function getTriggerMetaModel(cfg, cb) {
    var self = new SalesforceEntity(this);
    cfg.object = objectType;
    self.getOutMetaModel(cfg, cb);
};
