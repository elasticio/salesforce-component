const Q = require('q');
const util = require('util');
const httpUtils = require('./http-utils.js');

function getObjectDescription(cfg, cb) {
  const url = cfg.oauth.instance_url;
  const version = cfg.apiVersion || 'v25.0';
  const objType = cfg.object;

  const metadataURL = util.format('%s/services/data/%s/sobjects/%s/describe', url, version, objType);
  const authValue = util.format('Bearer %s', cfg.oauth.access_token);

  httpUtils.getJSON({
    url: metadataURL,
    auth: authValue,
  }, cb);
}

function fetchObjectTypes(conf, cb) {
  const url = conf.oauth.instance_url;
  const version = conf.apiVersion || 'v25.0';

  const metadataURL = util.format('%s/services/data/%s/sobjects', url, version);
  const authValue = util.format('Bearer %s', conf.oauth.access_token);

  httpUtils.getJSON({
    url: metadataURL,
    auth: authValue,
  }, (err, data) => {
    if (err) {
      return cb(err);
    }
    const result = {};
    data.sobjects.map((obj) => {
      result[obj.name] = obj.label;
    });
    cb(null, result);
  });
}

function describeObject(params) {
  return Q.nfcall(getObjectDescription, params.cfg);
}

exports.fetchObjectTypes = fetchObjectTypes;
exports.getObjectDescription = getObjectDescription;
exports.describeObject = describeObject;
