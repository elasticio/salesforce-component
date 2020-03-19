const Q = require('q');
const util = require('util');
const httpUtils = require('./http-utils.js');
const common = require('../common.js');

function getObjectDescription(logger, cfg, cb) {
  const url = cfg.oauth.instance_url;
  const objType = cfg.sobject;

  const metadataURL = util.format('%s/services/data/v%s/sobjects/%s/describe', url, common.globalConsts.SALESFORCE_API_VERSION, objType);
  const authValue = util.format('Bearer %s', cfg.oauth.access_token);

  httpUtils.getJSON(logger, {
    url: metadataURL,
    auth: authValue,
  }, cb);
}

function fetchObjectTypes(logger, conf, cb) {
  const url = conf.oauth.instance_url;

  const metadataURL = util.format('%s/services/data/v%s/sobjects', url, common.globalConsts.SALESFORCE_API_VERSION);
  const authValue = util.format('Bearer %s', conf.oauth.access_token);

  httpUtils.getJSON(logger, {
    url: metadataURL,
    auth: authValue,
    // eslint-disable-next-line consistent-return
  }, (err, data) => {
    if (err) {
      return cb(err);
    }
    const result = {};
    data.sobjects.forEach((obj) => {
      result[obj.name] = obj.label;
    });
    cb(null, result);
  });
}

function fetchLinkedObjectTypes(logger, conf, cb) {
  const url = conf.oauth.instance_url;

  const metadataURL = `${url}/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/${conf.object}/describe`;
  const authValue = `Bearer ${conf.oauth.access_token}`;

  const meta = httpUtils.getJSON(logger, {
    url: metadataURL,
    auth: authValue,
    // eslint-disable-next-line consistent-return
  }, (err, data) => {
    if (err) {
      return cb(err);
    }
    const result = {};
    data.sobjects.forEach((obj) => {
      result[obj.name] = obj.label;
    });
    cb(null, result);
  });

  console.log("meta", meta);

  const relatedObjs = {};
  const parents = meta.fields.filter(field => field.type === 'reference')
    .reduce((obj, field) => {
      if (!field.referenceTo.length) {
        throw new Error(
          `Empty referenceTo array for field of type 'reference' with name ${field.name} field=${JSON.stringify(
            field, null, ' ',
          )}`,
        );
      }
      if (field.relationshipName !== null) {
        // eslint-disable-next-line no-param-reassign
        obj[field.relationshipName] = `${field.referenceTo.join(', ')} (${field.relationshipName})`;
      }
      return obj;
    }, {});
  const children = meta.childRelationships.reduce((obj, child) => {
    if (child.relationshipName) {
      // add a '!' flag to distinguish between child and parent relationships,
      // will be popped off in lookupObject.processAction

      // eslint-disable-next-line no-param-reassign
      obj[`!${child.relationshipName}`] = `${child.childSObject} (${child.relationshipName})`;
    }
    return obj;
  }, {});
  Object.assign(relatedObjs, parents, children);
  return relatedObjs;
}

function describeObject(logger, params) {
  return Q.nfcall(getObjectDescription, logger, params.cfg);
}

exports.fetchObjectTypes = fetchObjectTypes;
exports.fetchLinkedObjectTypes = fetchLinkedObjectTypes;
exports.getObjectDescription = getObjectDescription;
exports.describeObject = describeObject;
