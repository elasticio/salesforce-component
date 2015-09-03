/**
 * Common functionality for OAuth
 **/
var httpUtils = require('./http-utils.js');
var util = require('util');
var handlebars = require('hbs').handlebars;
var Q = require('q');

/**
 * This function refreshes OAuth token.
 *
 * @param serviceUri
 * @param clientIdKey
 * @param clientSecretKey
 * @param conf
 * @param next
 */
var refreshToken = function (serviceUri, clientIdKey, clientSecretKey, conf, next) {

    var clientId = getValueFromEnv(clientIdKey);
    var clientSecret = getValueFromEnv(clientSecretKey);

    'use strict';
    var data = {
        "grant_type":"refresh_token",
        "client_id":clientId,
        "client_secret":clientSecret,
        "refresh_token": conf.oauth? conf.oauth.refresh_token : null,
        "format":"json"
    };

    // Now we need to resolve URI in case we have a replacement groups inside it
    // for example for Salesforce we have a production and test environemnt
    // or shopware the user domain is part of OAuth URIs
    var refreshURI = resolveVars(serviceUri, conf);

    httpUtils.getJSON({
        url:refreshURI,
        method:"post",
        form:data
    }, function (err, refreshResponse) {
        if (err) {
            console.error('Failed to refresh token from %s', serviceUri);
            return next(err);
        }
        console.log('Refreshed token from %s', serviceUri);
        // update access token in configuration
        conf.oauth.access_token = refreshResponse.access_token;
        // if new refresh_token returned, update that also
        // specification is here http://tools.ietf.org/html/rfc6749#page-47
        if (refreshResponse.refresh_token) {
            conf.oauth.refresh_token = refreshResponse.refresh_token;
        }
        next(null, conf);
    });
};

var getValueFromEnv = function(key) {
    var compiled = handlebars.compile(key);

    var value = compiled(process.env);

    if(value) {
        return value;
    }

    throw new Error(util.format("No value is defined for environment variable: '%s'", key));
};

var refreshAppToken = function (app, conf, cb) {
    var appDef = require('../../component.json');
    var credentials = appDef.credentials || {};

    var oauth2 = credentials["oauth2"];

    refreshToken(
        oauth2['token_uri'],
        oauth2['client_id'],
        oauth2['client_secret'],
        conf,
        cb);
};

/**
 * This function returns a promise that will refresh an OAuth Token
 * based on the configuration and appID
 *
 * It will read necessary information from the component registry
 * and fail in case of refresh failure
 *
 *
 */
function refreshTokenPromise (appID, conf) {
    var deferred = Q.defer();
    refreshAppToken(appID, conf, deferred.makeNodeResolver());
    return deferred.promise;
}

/**
 * This function resolves the variables in the string using hanlebars
 *
 * @param template
 * @param context
 * @returns {*}
 */
function resolveVars(template, context) {
    var compiled = handlebars.compile(template);
    return compiled(context);
}

exports.refreshToken = refreshToken;
exports.refreshAppToken = refreshAppToken;
exports.refreshTokenPromise = refreshTokenPromise;