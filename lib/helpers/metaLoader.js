const jsforce = require('jsforce');
const debug = require('debug')('MetaLoader');

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
  currency: 'number',
  int: 'number',
};

module.exports = class MetaLoader {
  constructor(configuration, emitter) {
    this.configuration = configuration;
    this.SALESFORCE_API_VERSION = '39.0';
    this.connection = new jsforce.Connection({
      oauth2: {
        clientId: process.env.SALESFORCE_KEY,
        clientSecret: process.env.SALESFORCE_SECRET,
        redirectUri: 'https://app.elastic.io/oauth/v2',
      },
      instanceUrl: this.configuration.oauth.instance_url,
      accessToken: this.configuration.oauth.access_token,
      refreshToken: this.configuration.oauth.refresh_token,
      version: this.SALESFORCE_API_VERSION,
    });
    this.connection.on('refresh', (accessToken, res) => {
      console.log('Keys were updated, res=%j', res);
      emitter.emit('updateKeys', {oauth: res});
    });

    this.connection.on('error', err => emitter.emit('error', err));
  }

  async getLookupFieldsModel() {
    return await this.connection.describe(this.configuration.sobject)
        .then(async meta => {
          const model = {};
          await meta.fields
              .filter(
                  field => field.externalId || field.unique || field.name ===
                      'Id' || field.type === 'reference')
              .forEach(field => {
                model[field.name] = field.label;
              });
          return model;
        });
  }

  async loadMetadata() {
    return await this.connection.describe(this.configuration.sobject)
        .then(async meta => await this.processMeta(meta)).then(metaData => {
          debug('emitting Metadata %j', metaData);
          return metaData;
        });
  }

  async loadSOQLRequest() {
    return await this.connection.describe(this.configuration.sobject)
        .then(meta => {
          return `SELECT ${meta.fields.map(field => field.name)
              .join(',')} FROM ${this.configuration.sobject}`;
        });
  }

  async processMeta(meta) {
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
    let fields = await meta.fields.filter(
        (field) => !field.deprecatedAndHidden);

    if (this.configuration.metaType !== 'lookup') {
      fields = await fields.filter(
          field => field.updateable && field.createable);
    }
    await fields.forEach(field => {
      if (this.configuration.metaType === 'lookup' && field.name ===
          this.configuration.lookupField) {
        inProp[field.name] = this.createProperty(field);
      } else if (this.configuration.metaType !== 'lookup' &&
          field.createable) {
        inProp[field.name] = this.createProperty(field);
      }
      outProp[field.name] = this.createProperty(field);
    });
    if (this.configuration.metaType === 'upsert') {
      Object.keys(inProp).forEach(key=>{
        inProp[key].required=false;
      });
      inProp.Id = {
        type: 'string',
        required: false,
        title: 'Id',
      };
    }
    return result;
  }

  /**
   * This method returns a property description for e.io proprietary schema
   *
   * @param field
   */

  createProperty(field) {
    const result = {};
    result.type = TYPES_MAP[field.type];
    if (!result.type) {
      throw new Error(
          `Can't convert type for type=${field.type} field=${JSON.stringify(
              field, null, ' ')}`);
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
    result.title = field.label;
    result.default = field.defaultValue;
    return result;
  }

  getObjectTypes() {
    console.log('Connecting to Salesforce');

    console.log('Fetching sobjects list');
    return this.connection.describeGlobal().then((response) => {
      const result = {};
      response.sobjects.filter(
          (object) => object.updateable && object.createable)
          .forEach((object) => {
            result[object.name] = object.label;
          });
      console.log('Found %s objects', Object.keys(result).length);
      debug('Found objects: %j', result);
      return result;
    });
  };
};

