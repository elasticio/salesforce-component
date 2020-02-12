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
  date: 'date',
  datetime: 'date',
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
    this.emitter = emitter;
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
      findFieldByLabel: function findFieldByLabel(fieldLabel) {
        return objMetaData.fields.find(field => field.label === fieldLabel);
      },
      isStringField: function isStringField(field) {
        return field && (field.soapType === 'tns:ID' || field.soapType === 'xsd:string');
      },
    };
  }

  async getLookupFieldsModel() {
    return this.connection.describe(this.configuration.sobject)
      .then(async (meta) => {
        const model = {};
        await meta.fields
          .filter(field => field.externalId || field.unique || field.name === 'Id' || field.type === 'reference')
          .forEach((field) => {
            model[field.name] = field.label;
          });
        return model;
      });
  }

  async getLookupFieldsModelWithTypeOfSearch(typeOfSearch) {
    if (typeOfSearch === 'uniqueFields') {
      return this.connection.describe(this.configuration.sobject)
        .then(async (meta) => {
          const model = {};
          await meta.fields
            .filter(field => field.type === 'id' || field.unique)
            .forEach((field) => {
              model[field.name] = `${field.label} (${field.name})`;
            });
          return model;
        });
    }
    return this.connection.describe(this.configuration.sobject)
      .then(async (meta) => {
        const model = {};
        await meta.fields
          .forEach((field) => {
            model[field.name] = `${field.label} (${field.name})`;
          });
        return model;
      });
  }

  async getLinkedObjectsModel() {
    const meta = await this.connection.describe(this.configuration.sobject);
    const relatedObjs = {};
    Object.assign(relatedObjs,
      meta.fields.filter(field => field.type === 'reference')
        .reduce((obj, field) => {
          if (!field.referenceTo.length) {
            throw new Error(
              `Empty referenceTo array for field of type 'reference' with name ${field.name} field=${JSON.stringify(
                field, null, ' ',
              )}`,
            );
          }
          if (field.relationshipName !== null) {
            obj[field.relationshipName] = `${field.referenceTo.join(', ')} (${field.relationshipName})`;
          }
          return obj;
        }, {}),
      meta.childRelationships.reduce((obj, child) => {
        if (child.relationshipName !== null) {
          // add a '!' flag to distinguish between child and parent relationships,
          // will be popped off in lookupObject.processAction
          obj[`!${child.relationshipName}`] = `${child.childSObject} (${child.relationshipName})`;
        }
        return obj;
      }, {}));
    return relatedObjs;
  }

  async loadMetadata() {
    return this.connection.describe(this.configuration.sobject)
      .then(async meta => this.processMeta(meta)).then((metaData) => {
        this.emitter.logger.debug('emitting Metadata %j', metaData);
        return metaData;
      });
  }

  async loadSOQLRequest() {
    return this.connection.describe(this.configuration.sobject)
      .then(meta => `SELECT ${meta.fields.map(field => field.name).join(',')} FROM ${this.configuration.sobject}`);
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
    result.in.properties = {};
    result.out.properties = {};
    const inProp = result.in.properties;
    const outProp = result.out.properties;
    let fields = await meta.fields.filter(field => !field.deprecatedAndHidden);

    if (this.configuration.metaType !== 'lookup') {
      fields = await fields.filter(field => field.updateable && field.createable);
    }
    await fields.forEach((field) => {
      if (this.configuration.metaType === 'lookup' && field.name === this.configuration.lookupField) {
        inProp[field.name] = this.createProperty(field);
      } else if (this.configuration.metaType !== 'lookup' && field.createable) {
        inProp[field.name] = this.createProperty(field);
      }
      outProp[field.name] = this.createProperty(field);
    });
    if (this.configuration.metaType === 'upsert') {
      Object.keys(inProp).forEach((key) => {
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
    this.emitter.logger.info(`Fetching ${what} list...`);
    return this.connection.describeGlobal().then((response) => {
      const result = {};
      response.sobjects.forEach((object) => {
        if (filter(object)) {
          result[object.name] = object.label;
        }
      });
      this.emitter.logger.info('Found %s sobjects', Object.keys(result).length);
      this.emitter.logger.debug('Found sobjects: %j', result);
      return result;
    });
  }

  getCreateableObjectTypes() {
    return this.getSObjectList('createable sobject', object => object.createable);
  }

  getUpdateableObjectTypes() {
    return this.getSObjectList('updateable sobject', object => object.updateable);
  }

  getObjectTypes() {
    return this.getSObjectList('updateable/createable sobject', object => object.updateable && object.createable);
  }

  getSearchableObjectTypes() {
    return this.getSObjectList('searchable sobject', object => object.queryable);
  }

  getPlatformEvents() {
    return this.getSObjectList('event sobject', object => object.name.endsWith('__e'));
  }
};

module.exports.TYPES_MAP = TYPES_MAP;
