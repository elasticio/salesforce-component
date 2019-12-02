const _ = require('lodash');
const util = require('util');
const httpUtils = require('./helpers/http-utils');
const converter = require('./helpers/metadata');
const describe = require('./helpers/describe');
const fetchObjectsQuery = require('./helpers/objectFetcherQuery');
const elasticio = require('elasticio-node');
const messages = elasticio.messages;
const createPresentableError = require('./helpers/error.js');
const Q = require('q');
const oAuthUtils = require('./helpers/oauth-utils.js');
const debug = require('debug')('salesforce:entry');
const jsforce = require('jsforce');
const common = require('./common.js');

exports.SalesforceEntity = SalesforceEntity;

function SalesforceEntity(callScope) {

  const self = this;

  /**
   * This function refreshes salesforce token
   * @param conf - configuration with so that conf.oauth.refresh_token should be available
   * @param next - callback that will be called with (err, conf) parameters
   */
  this.refreshToken = function refreshToken(conf, next) {
    'use strict';

    oAuthUtils.refreshAppToken('salesforce', conf,
        function afterrefresh(err, newConf) {
          if (err) {
            return next(err);
          }
          callScope.emit('updateKeys', {oauth: newConf.oauth});
          next(null, newConf);
        });
  };

  this.getInMetaModel = function getInMetaModel(cfg, cb) {
    getMetaModel('in', cfg, cb);
  };

  this.getOutMetaModel = function getOutMetaModel(cfg, cb) {
    getMetaModel('out', cfg, cb);
  };

  function getMetaModel(direction, cfg, cb) {
    self.refreshToken(cfg, function afterRefresh(err, newCfg) {
      if (err) {
        console.error('Error refreshing token', err);
        return cb(err);
      }
      describe.getObjectDescription(newCfg,
          function buildMetadata(err, objectDescription) {
            if (err) {
              cb(err);
            } else {
              let metadata = {};
              metadata[direction] = converter.buildSchemaFromDescription(
                  objectDescription, direction);
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
   * @param version - optional param for defines version of SalesSphere API to use
   * @param snapshot
   */
  this.processTrigger = async function processTrigger(msg, cfg, snapshot) {

    if (!snapshot || (typeof(snapshot) === 'object' && !snapshot.previousLastModified)) {
      snapshot = {
        previousLastModified: cfg.startTime || '1970-01-01T00:00:00.000Z',
      };
      console.log('Created snapshot: %j', snapshot)
    } else if (typeof snapshot === 'string') {
      // for backward compatibility
      snapshot = { previousLastModified: snapshot };
      console.log('Snapshot has been converted to: %j', snapshot);
    } else {
      console.log('Got snapshot: %j', snapshot)
    }

    const conn = new jsforce.Connection({
      oauth2: {
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
      },
      instanceUrl: cfg.oauth.instance_url,
      accessToken: cfg.oauth.access_token,
      refreshToken: cfg.oauth.refresh_token,
      version: common.globalConsts.SALESFORCE_API_VERSION,
    });
    conn.on('refresh', (accessToken, res) => {
      console.log('Keys were updated, res=%j', res);
      emitKeys({ oauth: res });
    });

    let maxFetch = 1000;

    if (cfg.sizeOfPollingPage){
      const sizeOfPollingPage = parseInt(cfg.sizeOfPollingPage, 10);
      if (sizeOfPollingPage && sizeOfPollingPage > 0 && sizeOfPollingPage <= 10000){
        maxFetch = sizeOfPollingPage;
      } else {
          emitError('Size of Polling Page needs to be positive integer, max 10000 objects');
          emitEnd();
          return;
      }
    }
    const singlePagePerInterval = (cfg.singlePagePerInterval !== 'no') ;
    const maxTime = cfg.endTime ? ` AND LastModifiedDate <= ${cfg.endTime}` : '';
    let hasMorePages = true;
    let lastSeenTime = snapshot.previousLastModified;

    do {
      let whereCondition;
      if (lastSeenTime === cfg.startTime || lastSeenTime === '1970-01-01T00:00:00.000Z')
        whereCondition = `LastModifiedDate >= ${lastSeenTime}${maxTime}`;
      else
        whereCondition = `LastModifiedDate > ${lastSeenTime}${maxTime}`;
      try {
          const results = await conn.sobject(cfg.object)
              .select('*')
              .where(whereCondition)
              .sort({LastModifiedDate: 1})
              .execute({autoFetch: true, maxFetch});
          processResults(results);
      } catch (err) {
          emitError(createPresentableError(err) || err);
          emitEnd();
          return;
      }
      if(singlePagePerInterval) {
        hasMorePages = false;
      }
    } while (hasMorePages);

    if (snapshot.previousLastModified !== lastSeenTime) {
        snapshot.previousLastModified = lastSeenTime;
        console.log('emitting new snapshot: %j', snapshot);
        emitSnapshot(snapshot);
    }
    emitEnd();

    function processResults(records) {
      if (!records || !records.length) {
        console.log('No new objects found');
        hasMorePages = false;
        return;
      }
      records.forEach((record, i) => {
        const msg = messages.newEmptyMessage();
        msg.headers = {
          objectId: record.attributes.url,
        };
        msg.body = record;
        console.log('emitting record %d', i);
        debug('emitting record: %j', msg);
        emitData(msg);
      });
      hasMorePages = records.length === maxFetch;
      lastSeenTime = records[records.length - 1].LastModifiedDate;
    }
  };

  this.processQuery = function processQuery(query, cfg) {
    'use strict';

    const params = {};
    params.cfg = cfg;
    params.cfg.apiVersion = `v${common.globalConsts.SALESFORCE_API_VERSION}`;

    params.query = query;

    Q.ninvoke(self, 'refreshToken', params.cfg)
        .then(updateCfg)
        .then(fetchObjectsQuery)
        .then(processResults)
        .fail(onError)
        .done(emitEnd);

    function updateCfg(cfg) {
      params.cfg = cfg;
      return params;
    }

    function processResults(results) {
      if (!results.objects.totalSize) {
        console.info('No new objects found');
        return;
      }
      results.objects.records.forEach(emitResultObject);
    }

    function emitResultObject(object) {
      const msg = messages.newEmptyMessage();
      msg.headers = {
        objectId: object.attributes.url,
      };
      msg.body = object;
      emitData(msg);
    }
  };

  /**
   * This function will fetch object data from salesforce
   * @param conf
   * @param next
   */
  this.listObjectTypes = function listObjectTypes(conf, next) {
    'use strict';

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
   * @param version - optional param for defines version of SalesSphere API to use
   * @param conf
   */
  this.processAction = function processAction(objectType, msg, conf) {

    self.refreshToken(conf, function onTokenRefreshed(err, newCfg) {
      if (err) {
        return onActionError(err);
      }
      postData(newCfg, checkPostResult, common.globalConsts.SALESFORCE_API_VERSION);
    });

    function postData(conf, next) {
      // Here we assume conf has a refreshed Salesforce token
      const baseUrl = conf.oauth.instance_url;
      const authValue = util.format('Bearer %s', conf.oauth.access_token);
      const url = util.format('%s/services/data/%s/sobjects/%s', baseUrl, `v${common.globalConsts.SALESFORCE_API_VERSION}`,
          objectType);

      debug('getJSON', msg.body);

      httpUtils.getJSON({
        url: url,
        method: 'POST',
        json: msg.body,
        auth: authValue,
        statusExpected: 201,
      }, next);
    }

    function checkPostResult(err, result) {
      if (err) {
        return onActionError(err);
      }
      msg.body = _.extend(msg.body, result);
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
    console.error('emitting SalesforceEntity error', err, err.stack);
    callScope.emit('error', err);
  }

  function onError(err) {
    emitError(createPresentableError(err) || err);
  }

  function emitData(data) {
    callScope.emit('data', data);
  }

  function emitSnapshot(snapshot) {
    callScope.emit('snapshot', snapshot);
  }

  function emitKeys(snapshot) {
    callScope.emit('updateKeys', snapshot);
  }

  function emitEnd() {
    callScope.emit('end');
  }
}

exports.SalesforceEntity = SalesforceEntity;

exports.buildAction = function buildAction(objectType, exports) {

  exports.process = function processAction(msg, conf) {
    const self = new SalesforceEntity(this);
    self.processAction(objectType, msg, conf, common.globalConsts.SALESFORCE_API_VERSION);
  };

  exports.getMetaModel = function getActionMetaModel(cfg, cb) {
    const self = new SalesforceEntity(this);
    cfg.object = objectType;
    self.getInMetaModel(cfg, function transformMetadata(err, data) {
      if (err) {
        return cb(err);
      }
      data.out = _.cloneDeep(data.in);
      data.out.properties.in = {
        type: 'string',
        required: true,
      };
      cb(null, data);
    });
  };
};

exports.buildTrigger = function buildTrigger(objectType, exports) {

  exports.process = function processTrigger(msg, conf, snapshot) {
    const self = new SalesforceEntity(this);
    // Set fixed object type to the configuration object
    conf.object = objectType;
    // Proceed as usual
    self.processTrigger(msg, conf, snapshot);
  };

  exports.getMetaModel = function getTriggerMetaModel(cfg, cb) {
    const self = new SalesforceEntity(this);
    cfg.object = objectType;
    self.getOutMetaModel(cfg, cb);
  };
};

exports.objectTypes = function objectTypes(conf, next) {
  const self = new SalesforceEntity(this);
  self.listObjectTypes(conf, next);
};

exports.process = function processEntry(msg, conf, snapshot) {
  const self = new SalesforceEntity(this);
  self.processTrigger(msg, conf, snapshot);
};

exports.getMetaModel = function getEntryMetaModel(cfg, cb) {
  const self = new SalesforceEntity(this);
  self.getOutMetaModel(cfg, cb);
};
