
const { SalesforceEntity } = require('../entry.js');

exports.process = function processTrigger(msg, conf) {
  const entity = new SalesforceEntity(this);
  const { query } = conf;
  return entity.processQuery(query, conf);
};
