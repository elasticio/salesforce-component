const jsforce = require('jsforce');
const common = require('./common.js');

class SalesForceClient {
  constructor(context, configuration) {
    this.logger = context.logger;
    this.configuration = configuration;
    this.connection = new jsforce.Connection({
      instanceUrl: configuration.instance_url,
      accessToken: configuration.access_token,
      version: common.globalConsts.SALESFORCE_API_VERSION,
    });
  }

  async describeGlobal() {
    return this.connection.describeGlobal();
  }

  async describe(sobject) {
    return this.connection.describe(sobject || this.configuration.sobject);
  }

  async getObjectFieldsMetaData() {
    return this.describe().then((meta) => meta.fields);
  }

  async getSObjectList(what, filter) {
    this.logger.debug(`Fetching ${what} list...`);
    const response = await this.describeGlobal();
    const result = {};
    response.sobjects.forEach((object) => {
      if (filter(object)) {
        result[object.name] = object.label;
      }
    });
    this.logger.debug('Found %s sobjects', Object.keys(result).length);
    return result;
  }

  async getObjectTypes() {
    return this.getSObjectList('updateable/createable sobject', (object) => object.updateable && object.createable);
  }

  async getCreateableObjectTypes() {
    return this.getSObjectList('createable sobject', (object) => object.createable);
  }

  async getUpdateableObjectTypes() {
    return this.getSObjectList('updateable sobject', (object) => object.updateable);
  }

  async getSearchableObjectTypes() {
    return this.getSObjectList('searchable sobject', (object) => object.queryable);
  }

  async getPlatformEvents() {
    return this.getSObjectList('event sobject', (object) => object.name.endsWith('__e'));
  }

  async queryEmitAll(query) {
    const result = [];
    await new Promise((resolve, reject) => {
      const response = this.connection.query(query)
        .scanAll(this.configuration.includeDeleted)
        .on('record', (record) => {
          result.push(record);
        })
        .on('end', () => {
          this.logger.debug('Query executed, total in database=%s, total fetched=%s', response.totalSize, response.totalFetched);
          resolve();
        })
        .on('error', (err) => {
          reject(err);
        });
    });
    return result;
  }

  async queryEmitBatch(query) {
    let batch = [];
    const results = [];
    const maxFetch = this.configuration.maxFetch || 1000;
    await new Promise((resolve, reject) => {
      const response = this.connection.query(query)
        .scanAll(this.configuration.includeDeleted)
        .on('record', (record) => {
          batch.push(record);
          if (batch.length >= this.configuration.batchSize) {
            this.logger.debug('Ready batch');
            results.push(batch);
            batch = [];
          }
        })
        .on('end', () => {
          if (batch.length > 0) {
            this.logger.debug('Pushing last batch');
            results.push(batch);
          }
          this.logger.debug('Query executed, total in database=%s, total fetched=%s', response.totalSize, response.totalFetched);
          resolve();
        })
        .on('error', (err) => {
          reject(err);
        })
        .run({ autoFetch: true, maxFetch });
    });
    return results;
  }

  async queryEmitIndividually(query) {
    const results = [];
    const maxFetch = this.configuration.maxFetch || 1000;
    await new Promise((resolve, reject) => {
      const response = this.connection.query(query)
        .scanAll(this.configuration.includeDeleted)
        .on('record', (record) => {
          results.push(record);
        })
        .on('end', () => {
          this.logger.debug('Query executed, total in database=%s, total fetched=%s', response.totalSize, response.totalFetched);
          resolve();
        })
        .on('error', (err) => {
          reject(err);
        })
        .run({ autoFetch: true, maxFetch });
    });
    return results;
  }

  async sobjectCreate(options) {
    const sobject = options.sobject || this.configuration.sobject;
    const { body } = options;
    return this.connection.sobject(sobject).create(body);
  }

  async sobjectDelete(options) {
    const sobject = options.sobject || this.configuration.sobject;
    const { id } = options;
    return this.connection.sobject(sobject).delete(id);
  }

  async sobjectUpdate(options) {
    const sobject = options.sobject || this.configuration.sobject;
    const { body } = options;
    return this.connection.sobject(sobject).update(body);
  }

  async sobjectUpsert(options) {
    const sobject = options.sobject || this.configuration.sobject;
    const extIdField = options.extIdField || this.configuration.extIdField;
    const { body } = options;
    return this.connection.sobject(sobject).upsert(body, extIdField);
  }

  async sobjectLookup(options) {
    const sobject = options.sobject || this.configuration.sobject;
    const lookupField = options.lookupField || this.configuration.lookupField;
    const { body } = options;
    const maxFetch = this.configuration.maxFetch || 1000;
    const results = [];
    await this.connection.sobject(sobject)
      .select('*')
      .where(`${lookupField} = '${body[lookupField]}'`)
      .on('record', (record) => {
        results.push(record);
      })
      .on('end', () => {
        this.logger.debug('Found %s records', results.length);
      })
      .on('error', (err) => {
        this.emit('error', err);
      })
      .execute({ autoFetch: true, maxFetch });
    return results;
  }

  async selectQuery(options) {
    const sobject = options.sobject || this.configuration.sobject;
    const results = [];
    const { condition } = options;
    await this.connection.sobject(sobject)
      .select('*')
      .where(condition)
      .on('record', (record) => {
        results.push(record);
      })
      .on('end', () => {
        this.logger.debug('Found %s records', results.length);
      })
      .on('error', (err) => {
        throw err;
      })
      .execute({ autoFetch: true, maxFetch: 2 });
    return results;
  }

  async pollingSelectQuery(options) {
    const sobject = options.sobject || this.configuration.sobject;
    const {
      selectedObjects, linkedObjects, whereCondition, maxFetch,
    } = options;
    let query = this.connection.sobject(sobject)
      .select(selectedObjects);

    // the query for all the linked child objects
    query = linkedObjects.reduce((newQuery, obj) => {
      if (obj.startsWith('!')) {
        return newQuery.include(obj.slice(1))
          .select('*')
          .end();
      }
      return newQuery;
    }, query);
    return query.where(whereCondition)
      .sort({ LastModifiedDate: 1 })
      .execute({ autoFetch: true, maxFetch });
  }

  async lookupQuery(options) {
    const records = [];
    const sobject = options.sobject || this.configuration.sobject;
    const includeDeleted = options.includeDeleted || this.configuration.includeDeleted;
    const { wherePart, offset, limit } = options;
    await this.connection.sobject(sobject)
      .select('*')
      .where(wherePart)
      .offset(offset)
      .limit(limit)
      .scanAll(includeDeleted)
      .on('error', (err) => {
        this.logger.error('Salesforce returned an error');
        throw err;
      })
      .on('record', (record) => {
        records.push(record);
      })
      .on('end', () => {
        this.logger.debug('Found %s records', records.length);
      })
      .execute({ autoFetch: true, maxFetch: limit });
    return records;
  }

  async bulkQuery(query) {
    return this.connection.bulk.query(query)
      .on('error', (err) => {
        throw err;
      })
      .stream();
  }

  async bulkCreateJob(options) {
    const { sobject, operation, extra } = options;
    return this.connection.bulk.createJob(sobject, operation, extra);
  }

  async objectMetaData() {
    const objMetaData = await this.describe();

    return {
      findFieldByLabel: function findFieldByLabel(fieldLabel) {
        return objMetaData.fields.find((field) => field.label === fieldLabel);
      },
      isStringField: function isStringField(field) {
        return field && (field.soapType === 'tns:ID' || field.soapType === 'xsd:string');
      },
    };
  }
}
module.exports.SalesForceClient = SalesForceClient;
