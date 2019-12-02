var Q = require('q');
var httpUtils = require('./http-utils.js');
var util = require('util');
const common = require('../common.js');

function getObjectDescription(cfg, cb) {
    'use strict';

    var url = cfg.oauth.instance_url;
    var objType = cfg.sobject;

    var metadataURL = util.format("%s/services/data/v%s/sobjects/%s/describe", url, common.globalConsts.SALESFORCE_API_VERSION, objType);
    var authValue = util.format("Bearer %s", cfg.oauth.access_token);

    httpUtils.getJSON({
        url: metadataURL,
        auth: authValue
    }, cb);
}

function fetchObjectTypes(conf, cb) {
    'use strict';

    var url = conf.oauth.instance_url;

    var metadataURL = util.format("%s/services/data/v%s/sobjects", url, common.globalConsts.SALESFORCE_API_VERSION);
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