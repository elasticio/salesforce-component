const jsforce = require('jsforce');

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
  constructor(configuration) {
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
  }

   getLookupFieldsModel() {
    return this.connection.describe(this.configuration.sobject)
        .then(async meta => {
          const model = {};
          await meta.fields
              .filter(field => field.externalId || field.unique || field.name === 'Id' || field.type === 'reference')
              .forEach(field=>{
                   model[field.name]=field.label;
              });
          return model;
        });
  }

  loadMetadata() {
    return this.connection.describe(this.configuration.sobject)
        .then(meta => this.processMeta(meta));
  }

  loadSOQLRequest() {
    return this.connection.describe(this.configuration.sobject)
        .then(meta => {
          return `SELECT ${meta.fields.map(field => field.name)
              .join(',')} FROM ${this.configuration.sobject}`;
        });
  }

  processMeta(meta) {
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
    meta.fields.filter(
        (field) => !field.deprecatedAndHidden && field.updateable &&
            field.createable)
        .forEach(field => {
          console.log(field.name);
          if (this.configuration.metaType === 'lookup' && field.name ===
              this.configuration.lookupField) {
            inProp[field.name] = this.createProperty(field);
          } else if (this.configuration.metaType !== 'lookup' &&
              field.createable) {
            inProp[field.name] = this.createProperty(field);
          }
          outProp[field.name] = this.createProperty(field);
        });
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
    result.readonly = field.calculated || !field.updateable;
    return result;
  }

};

