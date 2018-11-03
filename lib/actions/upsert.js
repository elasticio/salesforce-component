'use strict';
const jsforce = require('jsforce');
const httpUtils = require('../helpers/http-utils');
const describe = require('../helpers/describe');
const converter = require('../helpers/metadata');
const createPresentableError = require('../helpers/error.js');
const Q = require('q');


/**
 * See list on https://na45.salesforce.com/services/data/
 * @type {string}
 */
const SALESFORCE_API_VERSION = '39.0';

const TYPES_MAP = {
  id: 'string',
  boolean: 'boolean',
  string: 'string',
  double: 'float',
  textarea: 'string',
  reference: 'string',
  phone: 'string',
  date: 'date',
  datetime: 'date',
  picklist: 'string',
  email: 'string',
  address: 'address',
  url: 'string',
};

/**
 * This method returns a property description for e.io proprietary schema
 *
 * @param field
 */
function createProperty(field) {
  const result = {};
  result.type = TYPES_MAP[field.type];
  if (!result.type) {
    throw new Error(
        `Can't convert type for type=${field.type} field=${JSON.stringify(field,
            null, ' ')}`);
  }
  if (field.type === 'textarea') {
    result.maxLength = 1000;
  } else if (field.type === 'picklist') {
    result.enum = field.picklistValues.filter((p) => p.active)
        .map((p) => p.value);
  } else if (field.type === 'address') {
    result.type = 'object';
    result.properties = {
      city: {type: 'string'},
      country: {type: 'string'},
      postalCode: {type: 'string'},
      state: {type: 'string'},
      street: {type: 'string'},
    };
  }
  result.required = !field.nillable;
  return result;
}

/**
 * This function will be called to fetch available object types.
 *
 * Note: only updatable and creatable object types are returned here
 *
 * @param cfg
 */
function getObjectTypes(cfg) {
  console.log('Connecting to Salesforce');
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: process.env.SALESFORCE_KEY,
      clientSecret: process.env.SALESFORCE_SECRET,
      redirectUri: 'https://app.elastic.io/oauth/v2',
    },
    instanceUrl: cfg.oauth.instance_url,
    accessToken: cfg.oauth.access_token,
    refreshToken: cfg.oauth.refresh_token,
    version: SALESFORCE_API_VERSION,
  });
  conn.on('refresh', (accessToken, res) => {
    console.log('Keys were updated, res=%j', res);
    this.emit('updateKeys', {oauth: res});
  });
  conn.on('error', err => this.emit('error', err));
  console.log('Fetching sobjects list');
  return conn.describeGlobal().then((response) => {
    const result = {};
    response.sobjects.filter((object) => object.updateable && object.createable)
        .forEach((object) => {
          result[object.name] = object.label;
        });
    console.log('Found %s objects', Object.keys(result).length);
    return result;
  });
}

/**
 * This function will return a metamodel description for a particular object
 *
 * @param cfg
 */
function getMetaModel(cfg) {
  console.log('Connecting to Salesforce');
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: process.env.SALESFORCE_KEY,
      clientSecret: process.env.SALESFORCE_SECRET,
      redirectUri: 'https://app.elastic.io/oauth/v2',
    },
    instanceUrl: cfg.oauth.instance_url,
    accessToken: cfg.oauth.access_token,
    refreshToken: cfg.oauth.refresh_token,
    version: SALESFORCE_API_VERSION,
  });
  conn.on('refresh', (accessToken, res) => {
    console.log('Keys were updated, res=%j', res);
    this.emit('updateKeys', {oauth: res});
  });
  console.log('Fetching description for sobject=%s', cfg.sobject);
  return conn.describe(cfg.sobject).then((meta) => {
    const result = {
      in: {
        type: 'object',
      },
      out: {
        type: 'object',
      },
    };
    const inProp = result.in.properties = {};
    const outProp = result.out.properties = {};
    meta.fields.filter((field) => !field.deprecatedAndHidden)
        .forEach((field) => {
          try {
            if (field.createable) {
              inProp[field.name] = createProperty(field);
            }
            outProp[field.name] = createProperty(field);
          } catch (err) {
            console.log(err.stack);
          }
        });
    result.in.properties.Id = {
      type: 'string',
      required: false,
      title: 'Id',
    };
    return result;
  });
}

/**
 * This function will upsert given object
 *
 * @param msg
 * @param cfg
 */
function upsertObject(msg, cfg) {
  const self = this;
  cfg.object = cfg.sobject;
  console.log('Starting upsertObject');
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: process.env.SALESFORCE_KEY,
      clientSecret: process.env.SALESFORCE_SECRET,
      redirectUri: 'https://app.elastic.io/oauth/v2',
    },
    instanceUrl: cfg.oauth.instance_url,
    accessToken: cfg.oauth.access_token,
    refreshToken: cfg.oauth.refresh_token,
    version: SALESFORCE_API_VERSION,
  });
  conn.on('refresh', (accessToken, res) => {
    console.log('Keys were updated, res=%j', res);
    this.emit('updateKeys', {oauth: res});
  });
  console.log('Upserting sobject=%s extIdField=%s data=%j', cfg.sobject,
      cfg.extIdField, msg);
  if (msg.body.Id) {
    return conn.sobject(cfg.sobject).update(msg.body)
        .then(() => {
          return lookupById(cfg, msg, self);
        });
  } else {
    return conn.sobject(cfg.sobject).upsert(msg.body, cfg.extIdField);
  }
}

function lookupById(msg, cfg, self) {
  const params = {};
  params.cfg = cfg;
  params.cfg.apiVersion = params.cfg.apiVersion || 'v25.0';
  params.body = msg.body;

  Q.ninvoke(self, 'refreshToken', params.cfg)
      .then(updateCfg)
      .then(addSelectFields)
      .then(fetchObject)
      .then(processResults)
      .fail(onError)
      .done(self.emitEnd);

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
      console.log('No new objects found');
      return;
    }
    params.objects.records.forEach(function emitResultObject(object) {
      var msg = messages.newEmptyMessage();
      msg.headers = {
        objectId: object.attributes.url,
      };
      msg.metadata = params.metadata;
      msg.body = object;
      self.emitData(msg);
    });
  }

  function onError(err) {
    const presErr = createPresentableError(err) || err;
    console.error('emitting SalesforceEntity error', presErr, presErr.stack);
    self.emit('error', presErr);
  }
};

function fetchObject(params) {

  if (!params.cfg) {
    throw new Error('Can\'t fetch object without a configuration parameter');
  }
  if (!params.cfg.apiVersion) {
    throw new Error('Can\'t fetch object without an apiVersion');
  }
  if (!params.cfg.sobject) {
    throw new Error('Can\'t fetch object without an object type');
  }
  if (!params.body.Id) {
    throw new Error('Can\'t fetch object without an object Id');
  }

  const cfg = params.cfg;
  const objType = cfg.object;
  const selectFields = params.selectFields;
  const baseUrl = cfg.oauth.instance_url;
  const version = cfg.apiVersion;
  const queryUrl = util.format('%s/services/data/%s/query', baseUrl, version);
  const query = util.format('select %s from %s where Id = \'%s\'', selectFields,
      objType, body.Id);
  const queryString = url.format({
    query: {
      q: query,
    },
  });

  const authValue = util.format('Bearer %s', cfg.oauth.access_token);

  return Q.ninvoke(httpUtils, 'getJSON', {
    url: queryUrl + queryString,
    auth: authValue,
  }).then(function addObjectsToParams(objects) {
    params.objects = objects;
    return params;
  });
}

module.exports.process = upsertObject;
module.exports.getMetaModel = getMetaModel;
module.exports.objectTypes = getObjectTypes;