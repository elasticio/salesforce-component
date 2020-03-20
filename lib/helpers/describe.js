const Q = require('q');
const util = require('util');
const httpUtils = require('./http-utils.js');
const common = require('../common.js');

function getObjectDescription(logger, cfg, cb, isObj = false) {
  const url = cfg.oauth.instance_url;
  const objType = isObj ? cfg.object : cfg.sobject;

  const metadataURL = util.format('%s/services/data/v%s/sobjects/%s/describe', url, common.globalConsts.SALESFORCE_API_VERSION, objType);
  const authValue = util.format('Bearer %s', cfg.oauth.access_token);

  httpUtils.getJSON(logger, {
    url: metadataURL,
    auth: authValue,
  }, cb);
}

function fetchObjectTypes(logger, conf, cb) {
  const url = conf.oauth.instance_url;

  const metadataURL = util.format('%s/services/data/v%s/sobjects', url, common.globalConsts.SALESFORCE_API_VERSION);
  const authValue = util.format('Bearer %s', conf.oauth.access_token);

  httpUtils.getJSON(logger, {
    url: metadataURL,
    auth: authValue,
    // eslint-disable-next-line consistent-return
  }, (err, data) => {
    if (err) {
      return cb(err);
    }
    const result = {};
    data.sobjects.forEach((obj) => {
      result[obj.name] = obj.label;
    });
    cb(null, result);
  });
}

function describeObject(logger, params) {
  return Q.nfcall(getObjectDescription, logger, params.cfg);
}

exports.fetchObjectTypes = fetchObjectTypes;
exports.getObjectDescription = getObjectDescription;
exports.describeObject = describeObject;
