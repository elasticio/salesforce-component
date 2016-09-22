var _ = require('lodash');
var SalesforceEntity = require('../entry.js').SalesforceEntity;

exports.process = function processAction(msg, conf) {
    var entity = new SalesforceEntity(this);
    var query = msg.body.query;
    return entity.processQuery(query, conf);
};
