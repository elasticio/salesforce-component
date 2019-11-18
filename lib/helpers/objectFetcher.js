const Q = require('q');
const util = require('util');
const url = require('url');
const httpUtils = require('./http-utils.js');

function fetchObjects(params) {
  if (!params.cfg) {
    throw new Error('Can\'t fetch objects without a configuration parameter');
  }
  if (!params.cfg.apiVersion) {
    throw new Error('Can\'t fetch objects without an apiVersion');
  }
  if (!params.cfg.object) {
    throw new Error('Can\'t fetch objects without an object type');
  }
  if (!params.snapshot) {
    throw new Error('Can\'t fetch objects without a predefined snapshot');
  }

  const { cfg } = params;
  const objType = cfg.object;
  const { selectFields } = params;
  const { snapshot } = params;
  const baseUrl = cfg.oauth.instance_url;
  const version = cfg.apiVersion;

  const queryUrl = util.format('%s/services/data/%s/query', baseUrl, version);
  const query = util.format('select %s from %s where SystemModstamp > %s', selectFields, objType, snapshot);
  const queryString = url.format({
    query: {
      q: query,
    },
  });

  const authValue = util.format('Bearer %s', cfg.oauth.access_token);

  return Q.ninvoke(httpUtils, 'getJSON', {
    url: queryUrl + queryString,
    auth: authValue,
  }).then((objects) => {
    params.objects = objects;
    return params;
  });
}

module.exports = fetchObjects;
