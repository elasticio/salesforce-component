var Q = require('q');
var httpUtils = require('./http-utils.js');
var util = require('util');
var url = require('url');

function fetchObjects(params) {

    if (!params.cfg) {
        throw new Error('Can\'t fetch objects without a configuration parameter');
    }
    if (!params.cfg.apiVersion) {
        throw new Error('Can\'t fetch objects without an apiVersion');
    }
    if (!params.query) {
        throw new Error('Can\'t fetch objects without a query');
    }
    var cfg = params.cfg;
    var baseUrl = cfg.oauth.instance_url;
    var version = cfg.apiVersion;

    var queryUrl = util.format("%s/services/data/%s/query", baseUrl, version);
    var queryString = url.format({
        query: {
            q: params.query
        }
    });

    console.log('executing query:', params.query);

    var authValue = util.format("Bearer %s", cfg.oauth.access_token);

    return Q.ninvoke(httpUtils, 'getJSON', {
        url: queryUrl + queryString,
        auth: authValue
    }).then(function addObjectsToParams(objects) {
        params.objects = objects;
        return params;
    });
}

module.exports = fetchObjects;
