var _ = require('lodash');
var util = require('util');
var httpUtils = require('./helpers/http-utils');
var converter = require('./helpers/metadata');
var describe = require('./helpers/describe');
var fetchObjects = require('./helpers/objectFetcher');
var elasticio = require('elasticio-node');
var messages = elasticio.messages;
var createPresentableError = require('./helpers/error.js');
var Q = require('q');
var oAuthUtils = require('./helpers/oauth-utils.js');

function SalesforceEntity(callScope) {

    var self = this;

    /**
     * This function refreshes salesforce token
     * @param conf - configuration with so that conf.oauth.refresh_token should be available
     * @param next - callback that will be called with (err, conf) parameters
     */
    this.refreshToken = function refreshToken(conf, next) {
        'use strict';

        oAuthUtils.refreshAppToken('salesforce', conf, function afterrefresh(err, newConf) {
            if (err) {
                return next(err);
            }
            callScope.emit('updateKeys', {oauth: newConf.oauth});
            next(null, newConf);
        });
    };

    this.getInMetaModel = function getInMetaModel(cfg, cb) {
        getMetaModel("in", cfg, cb);
    };

    this.getOutMetaModel = function getOutMetaModel(cfg, cb) {
        getMetaModel("out", cfg, cb);
    };

    function getMetaModel(direction, cfg, cb) {
        self.refreshToken(cfg, function afterRefresh(err, newCfg) {
            if (err) {
                console.error('Error refreshing token', err);
                return cb(err);
            }
            describe.getObjectDescription(newCfg, function buildMetadata(err, objectDescription) {
                if (err) {
                    cb(err);
                } else {
                    var metadata = {};
                    metadata[direction] = converter.buildSchemaFromDescription(objectDescription);
                    cb(null, metadata);
                }
            });
        });
    }

    /**
     * Polling function that will pull changes from Salesforce
     *
     * @param msg - message is null
     * @param cfg - configuration
     * @param next - next callback
     * @param snapshot
     */
    this.processTrigger = function processTrigger(msg, cfg, snapshot) {
        "use strict";

        var params = {};
        params.cfg = cfg;
        params.cfg.apiVersion = params.cfg.apiVersion || "v25.0";
        params.snapshot = snapshot;

        if (!params.snapshot || typeof params.snapshot !== "string" || params.snapshot === '') {
            // Empty snapshot
            console.warn("Warning: expected string in snapshot but found : ", params.snapshot);
            params.snapshot = new Date("1970-01-01T00:00:00.000Z").toISOString();
        }

        var newSnapshot = new Date().toISOString();

        Q.ninvoke(self, 'refreshToken', params.cfg)
            .then(updateCfg)
            .then(addSelectFields)
            .then(fetchObjects)
            .then(processResults)
            .fail(onTriggerError)
            .done(emitEnd);

        function updateCfg(cfg) {
            params.cfg = cfg;
            return params;
        }

        function addSelectFields(params) {

            return describe.describeObject(params)
                .then(converter.buildSchemaFromDescription)
                .then(addMetadataToParams)
                .then(converter.pickSelectFields)
                .then(addSelectFieldsToParams);

            function addMetadataToParams(metadata) {
                params.metadata = metadata;
                return metadata;
            }

            function addSelectFieldsToParams(selectFields) {
                params.selectFields = selectFields;
                return params;
            }
        }

        function processResults(params) {
            if (!params.objects.totalSize) {
                console.log('No new contacts found');
                return;
            }
            params.objects.records.forEach(function emitResultObject(object) {
                var msg = messages.newEmptyMessage();
                msg.headers = {
                    objectId: object.attributes.url
                };
                msg.metadata = params.metadata;
                msg.body = object;
                emitData(msg);
            });
            emitSnapshot(newSnapshot);
        }

        function onTriggerError(err) {
            emitError(createPresentableError(err) || err);
        }
    };

    /**
     * This function will fetch object data from salesforce
     * @param conf
     * @param next
     */
    this.listObjectTypes = function listObjectTypes(conf, next) {
        "use strict";

        self.refreshToken(_.clone(conf), function onTokenRefreshed(err, newCfg) {
            if (err) {
                return next(err);
            }
            describe.fetchObjectTypes(newCfg, next);
        });
    };

    /**
     * This function modify a scope and add two functions process and getMetaModel
     *
     * @param objectType
     * @param msg
     * @param conf
     */
    this.processAction = function processAction(objectType, msg, conf) {
        'use strict';

        self.refreshToken(conf, function onTokenRefreshed(err, newCfg) {
            if (err) {
                return onActionError(err);
            }
            postData(newCfg, checkPostResult);
        });

        function postData(conf, next) {
            // Here we assume conf has a refreshed Salesforce token
            var version = conf.apiVersion || "v25.0";
            var baseUrl = conf.oauth.instance_url;
            var authValue = util.format("Bearer %s", conf.oauth.access_token);
            var url = util.format("%s/services/data/%s/sobjects/%s", baseUrl, version, objectType);

            httpUtils.getJSON({
                url: url,
                method: "POST",
                json: msg.body,
                auth: authValue,
                statusExpected: 201
            }, next);
        }

        function checkPostResult(err, result) {
            if (err) {
                return onActionError(err);
            }
            msg.body = result;
            onActionSuccess(msg);
        }

        function onActionError(err) {
            emitError(err);
            emitEnd();
        }

        function onActionSuccess(msg) {
            emitData(msg);
            emitEnd();
        }
    };

    function emitError(err) {
        callScope.emit('error', err);
    }

    function emitData(data) {
        callScope.emit('data', data);
    }

    function emitSnapshot(snapshot) {
        callScope.emit('snapshot', snapshot);
    }

    function emitEnd() {
        callScope.emit('end');
    }
}

exports.SalesforceEntity = SalesforceEntity;

exports.buildAction = function buildAction(objectType, exports) {

    exports.process = function processAction(msg, conf) {
        var self = new SalesforceEntity(this);
        self.processAction(objectType, msg, conf);
    };

    exports.getMetaModel = function getActionMetaModel(cfg, cb) {
        var self = new SalesforceEntity(this);
        cfg.object = objectType;
        self.getInMetaModel(cfg, cb);
    };
};

exports.buildTrigger = function buildTrigger(objectType, exports) {

    exports.process = function processTrigger(msg, conf, snapshot) {
        var self = new SalesforceEntity(this);
        // Set fixed object type to the configuration object
        conf.object = objectType;
        // Proceed as usual
        self.processTrigger(msg, conf, snapshot);
    };

    exports.getMetaModel = function getTriggerMetaModel(cfg, cb) {
        var self = new SalesforceEntity(this);
        cfg.object = objectType;
        self.getOutMetaModel(cfg, cb);
    };
};

exports.objectTypes = function objectTypes(conf, next) {
    var self = new SalesforceEntity(this);
    self.listObjectTypes(conf, next);
};

exports.process = function processEntry(msg, conf, snapshot) {
    var self = new SalesforceEntity(this);
    self.processTrigger(msg, conf, snapshot);
};

exports.getMetaModel = function getEntryMetaModel(cfg, cb) {
    var self = new SalesforceEntity(this);
    self.getOutMetaModel(cfg, cb);
};
