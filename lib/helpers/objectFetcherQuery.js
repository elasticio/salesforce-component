const Q = require('q');
const util = require('util');
const url = require('url');
const httpUtils = require('./http-utils.js');

function fetchObjects(logger, params) {
  if (!params.cfg) {
    throw new Error('Can\'t fetch objects without a configuration parameter');
  }
  if (!params.cfg.apiVersion) {
    throw new Error('Can\'t fetch objects without an apiVersion');
  }
  if (!params.query) {
    throw new Error('Can\'t fetch objects without a query');
  }
  const { cfg } = params;
  const baseUrl = cfg.oauth.instance_url;
  const version = cfg.apiVersion;

  const queryUrl = util.format('%s/services/data/%s/query', baseUrl, version);
  const queryString = url.format({
    query: {
      q: params.query,
    },
  });

  logger.info('executing query:', params.query);

  const authValue = util.format('Bearer %s', cfg.oauth.access_token);

  return Q.ninvoke(httpUtils, 'getJSON', logger, {
    url: queryUrl + queryString,
    auth: authValue,
  }).then((objects) => {
    // eslint-disable-next-line no-param-reassign
    params.objects = objects;
    return params;
  });
}

module.exports = fetchObjects;
