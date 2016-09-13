
var SalesforceEntity = require('../entry.js').SalesforceEntity;

exports.process = function processTrigger(msg, conf, snapshot) {
    var entity = new SalesforceEntity(this);
    return entity.processQueryTrigger(msg, conf, snapshot);
};
