var Q = require('q');
var httpUtils = require('./http-utils.js');
var util = require('util');

function getObjectDescription(cfg, cb) {
    'use strict';

    var url = cfg.oauth.instance_url;
    var version = cfg.apiVersion || "v25.0";
    var objType = cfg.object;

    var metadataURL = util.format("%s/services/data/%s/sobjects/%s/describe", url, version, objType);
    var authValue = util.format("Bearer %s", cfg.oauth.access_token);

    httpUtils.getJSON({
        url: metadataURL,
        auth: authValue
    }, cb);
}

function fetchObjectTypes(conf, cb) {
    'use strict';

    var url = conf.oauth.instance_url;
    var version = conf.apiVersion || "v25.0";

    var metadataURL = util.format("%s/services/data/%s/sobjects", url, version);
    var authValue = util.format("Bearer %s", conf.oauth.access_token);

    httpUtils.getJSON({
        url: metadataURL,
        auth: authValue
    }, function onObjectTypesFetched(err, data) {
        if (err) {
            return cb(err);
        }
        var result = {};
        data.sobjects.map(function addObjectType(obj) {
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