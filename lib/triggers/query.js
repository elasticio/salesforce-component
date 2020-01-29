
var SalesforceEntity = require('../entry.js').SalesforceEntity;

exports.process = function processTrigger(msg, conf) {
    var entity = new SalesforceEntity(this);
    var query = conf.query;
    return entity.processQuery(query, conf);
};
