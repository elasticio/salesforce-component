const jsforce = require('jsforce');
const debug = require('debug')('salesforce:metaLoader');
const sfConnection = require('./sfConnection.js');

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
  constructor(configuration, emitter, connection) {
    this.configuration = configuration;
    if (connection) {
      this.connection = connection;
    } else {
      this.connection = sfConnection.createConnection(configuration, emitter);
    }
  }

  getObjectMetaData() {
    return this.connection.describe(this.configuration.sobject);
  }

  getObjectFieldsMetaData() {
    return this.getObjectMetaData().then(meta => meta.fields);
  }

  async ObjectMetaData() {
    const objMetaData = await this.getObjectMetaData();

    return {
      findFieldByLabel: function (fieldLabel) {
        return objMetaData.fields.find(field => field.label === fieldLabel);
      },
      isStringField: function (field) {
        return field && (field.soapType === "tns:ID" || field.soapType === "xsd:string");
      }
    }
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
    result.required = !field.nillable && !field.defaultedOnCreate;
    result.title = field.label;
    result.default = field.defaultValue;
    return result;
  }

  getSObjectList(what, filter) {
    console.log(`Fetching ${what} list...`);
    return this.connection.describeGlobal().then((response) => {
      const result = {};
      response.sobjects.forEach((object) => {
        if (filter(object))
          result[object.name] = object.label;
      });
      console.log('Found %s sobjects', Object.keys(result).length);
      debug('Found sobjects: %j', result);
      return result;
    });
  };

  getCreateableObjectTypes() {
    return this.getSObjectList("createable sobject", (object) => object.createable);
  };

  getUpdateableObjectTypes() {
    return this.getSObjectList("updateable sobject", (object) => object.updateable);
  };

  getObjectTypes() {
    return this.getSObjectList("updateable/createable sobject", (object) => object.updateable && object.createable);
  };

  getSearchableObjectTypes() {
    return this.getSObjectList("searchable sobject", (object) => object.queryable);
  };

  getPlatformEvents() {
    return this.getSObjectList("event sobject", (object) => object.name.endsWith('__e'));
  };
};

module.exports.TYPES_MAP = TYPES_MAP;