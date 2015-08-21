var _ = require("underscore");
var request = require('request');
var util = require('util');
var httpUtils = require('../http-utils.js');
var converter = require('./metadata.js');
var describeObjects = require('./helpers/describe');
var fetchObjects = require('./helpers/objectFetcher');
var toSelectFields = require('./helpers/metadataToSelectFields');
var messages = require('../messages');
var createPresentableError = require('./errors/error.js');
var Q = require('q');
var oAuthUtils = require('../oauth-utils.js');

var SalesforceEntity = function(callScope) {

    var entity = this;

    /**
     * This function refreshes salesforce token
     * @param conf - configuration with so that conf.oauth.refresh_token should be available
     * @param next - callback that will be called with (err, conf) parameters
     */
    this.refreshToken = function (conf, next) {
        'use strict';

        // we need refresh_token from original configuration below
        var originalConf = _.clone(conf);

        oAuthUtils.refreshAppToken('salesforce', conf, function(err, newConf){
            if (err) {
                return next(err);
            }

            // use original refresh_token if no refresh_token in result
            newConf.oauth.refresh_token = newConf.oauth.refresh_token ? newConf.oauth.refresh_token : originalConf.oauth.refresh_token;

            callScope.request.emit('updateAccessToken', {
                accountId: newConf._account,
                oauth: newConf.oauth
            });

            next(null, newConf);
        });
    };

    var _requestModel = function (cfg, cb) {
        var url = cfg.oauth.instance_url;
        var version = cfg.apiVersion || "v25.0";
        var objType = cfg.object;

        var metadataURL = util.format("%s/services/data/%s/sobjects/%s/describe", url, version, objType);
        var authValue = util.format("Bearer %s", cfg.oauth.access_token);

        httpUtils.getJSON({
            url: metadataURL,
            auth: authValue
        }, function (err, metadata) {
            if (err) {
                cb(err);
            } else {
                var jsonSchema = converter(metadata);
                cb(null, jsonSchema);
            }
        });
    };

    /**
     * Returns a closure to post data
     *
     * @param objType
     * @return {Function}
     * @private
     */
    function _postData(objType, msg) {
        return function (conf, next) {
            'use strict';
            // Here we assume conf has a refreshed Salesforce token
            var version = conf.apiVersion || "v25.0";
            var baseUrl = conf.oauth.instance_url;
            var authValue = util.format("Bearer %s", conf.oauth.access_token);

            var url = util.format("%s/services/data/%s/sobjects/%s", baseUrl, version, objType);

            var data = msg.body;

            httpUtils.getJSON({
                url: url,
                method: "POST",
                json: data,
                auth: authValue,
                statusExpected: 201
            }, function (err, data) {
                if (err) {
                    return next(err);
                }
                next(null, data);
            });
        };

    }

    this.getInMetaModel = function (cfg, cb) {
        getInOutMetaModel("in", cfg, cb);
    };

    this.getOutMetaModel = function (cfg, cb) {
        getInOutMetaModel("out", cfg, cb);
    };

    var getInOutMetaModel = function (direction, cfg, cb) {
        entity.refreshToken(cfg, function (err, newCfg) {
            if (err) {
                console.error('Error refreshing token', err);
                return cb(err);
            }

            _requestModel(newCfg, function (err, jsonSchema) {
                if (err) {
                    cb(err);
                } else {
                    var metadata = {};

                    metadata[direction] = jsonSchema;

                    cb(null, metadata);
                }
            });
        });
    };

    /**
     * This function fetches all object types
     *
     * @private
     */
    var _fetchObjectTypes = function (conf, cb) {
        'use strict';
        var url = conf.oauth.instance_url;
        var version = conf.apiVersion || "v25.0";
        var objType = conf.object;

        // https://na1.salesforce.com/services/data/v26.0/sobjects/
        var metadataURL = util.format("%s/services/data/%s/sobjects", url, version);
        var authValue = util.format("Bearer %s", conf.oauth.access_token);

        httpUtils.getJSON({
            url: metadataURL,
            auth: authValue
        }, function (err, data) {
            if (err) {
                return cb(err);
            }
            var sobjects = data.sobjects;
            var result = {};
            sobjects.map(function (obj) {
                result[obj.name] = obj.label;
            });
            cb(null, result);
        });

    };

    /**
     * Polling function that will pull changes from Salesforce
     *
     * @param msg - message is null
     * @param conf - configuration
     * @param next - next callback
     * @param state - state, maintained between calls
     */
    this.process = function (msg, conf, next, snapshot) {
        "use strict";

        var params = {};

        params.cfg = conf;
        params.cfg.apiVersion = params.cfg.apiVersion || "v25.0";
        params.snapshot = snapshot;

        if (!params.snapshot || typeof params.snapshot !== "string" || params.snapshot === '') {
            // Empty snapshot
            console.warn("Warning: expected string in snapshot but found : ", params.snapshot);
            params.snapshot = new Date("1970-01-01T00:00:00.000Z").toISOString();
        }

        var newSnapshot = new Date().toISOString();

        var tokenPromise = Q.nbind(entity.refreshToken, entity);

        tokenPromise(params.cfg).then(function (cfg) {

            params.cfg = cfg;

            return params;
        })
            .then(describeObjects)
            .then(function (params) {
                var metadata = converter(params.description);

                params.metadata = metadata;

                return params;
            })
            .then(toSelectFields)
            .then(fetchObjects)
            .then(function (params) {

                if (!params.objects.totalSize) {

                    console.log('No new contacts found');

                    next();

                    return;
                }

                params.objects.records.forEach(function (object) {
                    var msg = messages.newEmptyMessage();

                    msg.headers = {
                        objectId: object.attributes.url
                    };

                    msg.metadata = params.metadata;
                    msg.body = object;

                    next(null, msg, newSnapshot);
                });

            }).fail(function (err) {

                next(createPresentableError(err) || err);

            }).done();
    };


    /**
     * This function will fetch object data from salesforce
     * @param conf
     * @param cb
     */
    this.objectTypes = function (conf, next) {
        "use strict";

        entity.refreshToken(_.clone(conf), function (err, newCfg) {
            if (err) {
                return next(err);
            }
            _fetchObjectTypes(newCfg, function (err, result) {
                if (err) {
                    return next(err);
                }
                next(null, result);
            });
        });
    };

    /**
     * This function modify a scope and add two functions process and getMetaModel
     *
     * @param objectType
     * @param scope
     */
    this.processAction = function (objectType, msg, conf, next) {
        'use strict';

        var postData = _postData(objectType, msg);

        entity.refreshToken(conf, function (err, newCfg) {
            if (err) {
                return next(err);
            }

            postData(newCfg, function (err, result) {
                msg.body = result;
                next(err, msg);
            });
        });
    };
};

exports.SalesforceEntity = SalesforceEntity;

exports.buildNewAction = function(objectType, exports){

    exports.process = function (msg, conf, next) {
        var entity = new SalesforceEntity(this);
        entity.processAction(objectType, msg, conf, next);
    };

    exports.getMetaModel = function (cfg, cb) {
        var entity = new SalesforceEntity(this);
        cfg.object = objectType;
        entity.getInMetaModel(cfg, cb);
    };
};

exports.buildTrigger = function(objectType, exports){

    exports.process = function (msg, conf, next, snapshot) {
        var entity = new SalesforceEntity(this);
        // Set fixed object type to the configuration object
        conf.object = objectType;
        // Proceed as usual
        entity.process(msg, conf, next, snapshot);
    };

    exports.getMetaModel = function(cfg, cb) {
        var entity = new SalesforceEntity(this);
        cfg.object = objectType;
        entity.getOutMetaModel(cfg, cb);
    };
};

exports.objectTypes = function (conf, next) {
    var entity = new SalesforceEntity(this);
    entity.objectTypes(conf, next);
};

exports.process = function (msg, conf, next, snapshot) {
    var entity = new SalesforceEntity(this);
    entity.process(msg, conf, next, snapshot);
};

exports.getMetaModel = function (cfg, cb) {
    var entity = new SalesforceEntity(this);
    entity.getOutMetaModel(cfg, cb);
};
