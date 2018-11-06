const jsforce = require('jsforce');
const messages = require('elasticio-node').messages;
const describe = require('../helpers/describe');
const converter = require('../helpers/metadata');
/**
 * See list on https://na45.salesforce.com/services/data/
 * @type {string}
 */
const SALESFORCE_API_VERSION = '39.0';

exports.process = function processAction(msg, conf) {

  console.log('Starting SOQL query=%s', msg.body.query);
  const conn = new jsforce.Connection({
    oauth2: {
      clientId: process.env.SALESFORCE_KEY,
      clientSecret: process.env.SALESFORCE_SECRET,
      redirectUri: 'https://app.elastic.io/oauth/v2',
    },
    instanceUrl: conf.oauth.instance_url,
    accessToken: conf.oauth.access_token,
    refreshToken: conf.oauth.refresh_token,
    version: SALESFORCE_API_VERSION,
  });
  conn.on('refresh', (accessToken, res) => {
    console.log('Keys were updated, res=%j', res);
    this.emit('updateKeys', {oauth: res});
  });

  const params = {};
  params.cfg = conf;
  params.cfg.apiVersion = SALESFORCE_API_VERSION;
  params.body = msg.body;

  // conn.query(msg.body.query)
  //     .on('record', (record) => {
  //         this.emit('data', messages.newMessageWithBody(record));
  //     })
  //     .on('end', () => {
  //       console.log('total in database=%s', result.totalSize);
  //       console.log('total fetched=%s', result.totalFetched);
  //     })
  //     .on('error', (err) => {
  //       console.error(err);
  //       this.emit('error', err);
  //     })
  //     .run({autoFetch: true, maxFetch: 1000});

  this.emit('data', messages.newMessageWithBody(conf));

};

/**
 * This function will be called to fetch available object types.
 *
 * Note: only updatable and creatable object types are returned here
 *
 * @param cfg
 */
module.exports.objectTypes = function getObjectTypes(cfg) {
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
module.exports.getMetaModel = function getMetaModel(cfg) {
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
