
var SalesforceEntity = require('../entry.js').SalesforceEntity;

exports.process = function processTrigger(msg, conf, snapshot) {
    var entity = new SalesforceEntity(this);
    var query = params.cfg.query;
    return entity.processQuery(query, conf, snapshot);
};
