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
    if (!params.cfg.object) {
        throw new Error('Can\'t fetch objects without an object type');
    }
    if (!params.snapshot) {
        throw new Error('Can\'t fetch objects without a predefined snapshot');
    }

    var cfg = params.cfg;
    var objType = cfg.object;
    var selectFields = params.selectFields;
    var snapshot = params.snapshot;
    var baseUrl = cfg.oauth.instance_url;
    var version = cfg.apiVersion;

    var queryUrl = util.format("%s/services/data/%s/query", baseUrl, version);
    var query = util.format("select %s from %s where SystemModstamp > %s", selectFields, objType, snapshot);
    var queryString = url.format({
        query: {
            q: query
        }
    });

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