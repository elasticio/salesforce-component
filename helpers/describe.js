var Q = require('q');
var httpUtils = require('../../http-utils.js');
var util = require('util');

function describe(params) {

    var cfg = params.cfg;

    var url = cfg.oauth.instance_url;
    var version = cfg.apiVersion;
    var objType = cfg.object;

    var metadataURL = util.format("%s/services/data/%s/sobjects/%s/describe", url, version, objType);
    var authValue = util.format("Bearer %s", cfg.oauth.access_token);

    var httpPromise = Q.nbind(httpUtils.getJSON, httpUtils);

    return Q.fcall(function () {
        return {
            url: metadataURL,
            auth: authValue
        };
    }).then(httpPromise).then(function (result) {

        params.description = result;
        return params;
    });
};

module.exports = describe;