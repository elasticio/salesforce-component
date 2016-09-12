var _ = require('lodash');
var SalesforceEntity = require('../entry.js').SalesforceEntity;

exports.process = function processAction(msg, conf, snapshot) {
    var entity = new SalesforceEntity(this);
    return entity.processQueryAction(msg, conf, snapshot);
};
