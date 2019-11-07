const jsforce = require('jsforce');
const debug = require('debug')('salesforce:metaLoader');

const TYPES_MAP = {
  address: 'address',
  anyType: 'string',
  base64: 'string',
  boolean: 'boolean',
  byte: 'string',
  calculated: 'string',
  combobox: 'string',
  currency: 'number',
  DataCategoryGroupReference: 'string',
  date: 'string',
  datetime: 'string',
  double: 'number',
  encryptedstring: 'string',
  email: 'string',
  id: 'string',
  int: 'number',
  JunctionIdList: 'JunctionIdList',
  location: 'location',
  masterrecord: 'string',
  multipicklist: 'multipicklist',
  percent: 'double',
  phone: 'string',
  picklist: 'string',
  reference: 'string',
  string: 'string',
  textarea: 'string',
  time: 'string',
  url: 'string',
};

module.exports = class MetaLoader {
  constructor(configuration, emitter) {
    this.configuration = configuration;
    this.SALESFORCE_API_VERSION = '39.0';
    this.connection = new jsforce.Connection({
      oauth2: {
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        redirectUri: 'https://app.elastic.io/oauth/v2',
      },
      instanceUrl: this.configuration.oauth.instance_url,
      accessToken: this.configuration.oauth.access_token,
      refreshToken: this.configuration.oauth.refresh_token,
      version: this.SALESFORCE_API_VERSION,
    });
    this.connection.on('refresh', (accessToken, res) => {
      console.log('Keys were updated, res=%j', res);
      emitter.emit('updateKeys', { oauth: res });
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

  async getLookupFieldsModelWithTypeOfSearch(typeOfSearch) {
    if (typeOfSearch === 'uniqueFields')
    return await this.connection.describe(this.configuration.sobject)
      .then(async meta => {
        const model = {};
        await meta.fields
          .filter(field => field.type === 'id' || field.unique)
          .forEach(field => {
            model[field.name] = `${field.label} (${field.name})`;
          });
        return model;
      });
    else
      return await this.connection.describe(this.configuration.sobject)
          .then(async meta => {
            const model = {};
            await meta.fields
                .forEach(field => {
                  model[field.name] = `${field.label} (${field.name})`;
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
      Object.keys(inProp).forEach(key => {
        inProp[key].required = false;
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
    let result = {};
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
    } else if (field.type === 'multipicklist') {
      result = {
        type: "array",
        items: {
          type: "string",
          enum: field.picklistValues.filter((p) => p.active)
            .map((p) => p.value)
        }
      }
    } else if (field.type === 'JunctionIdList') {
      result = {
        type: "array",
        items: {
          type: "string",
        }
      }
    } else if (field.type === 'address') {
      result.type = 'object';
      result.properties = {
        city: { type: 'string' },
        country: { type: 'string' },
        postalCode: { type: 'string' },
        state: { type: 'string' },
        street: { type: 'string' },
      };
    } else if (field.type === 'location') {
      result.type = 'object';
      result.properties = {
        latitude: { type: 'string' },
        longitude: { type: 'string' },
      };
    }
    result.required = !field.nillable;
    result.title = field.label;
    result.default = field.defaultValue;
    return result;
  }

  getObjectTypes() {
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

  getSearchableObjectTypes() {
    console.log('Fetching sobjects list');
    return this.connection.describeGlobal().then((response) => {
      const result = {};
      response.sobjects.filter(
        (object) => object.searchable)
        .forEach((object) => {
          result[object.name] = object.label;
        });
      console.log('Found %s objects', Object.keys(result).length);
      debug('Found objects: %j', result);
      return result;
    });
  };

  getPlatformEvents() {
    console.log('Fetching event objects list');
    return this.connection.describeGlobal().then((response) => {
      const result = {};
      response.sobjects.filter(
        (object) => object.name.endsWith('__e'))
        .forEach((object) => {
          result[object.name] = object.label;
        });
      console.log('Found %s objects', Object.keys(result).length);
      debug('Found objects: %j', result);
      return result;
    });
  };
};

