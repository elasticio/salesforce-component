const jsforce = require('jsforce');
const common = require('../lib/common.js');

class SalesForceClient {
  constructor(context, configuration) {
    this.logger = context.logger;
    this.configuration = configuration;
    this.connection = new jsforce.Connection({
      // ToDo: Delete 'https://na98.salesforce.com' after implementation https://github.com/elasticio/elasticio/issues/4527
      instanceUrl: configuration.instance_url || 'https://na98.salesforce.com',
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
    return this.describe().then(meta => meta.fields);
  }

  async getSObjectList(what, filter) {
    this.logger.info(`Fetching ${what} list...`);
    const response = await this.describeGlobal();
    const result = {};
    response.sobjects.forEach((object) => {
      if (filter(object)) {
        result[object.name] = object.label;
      }
    });
    this.logger.info('Found %s sobjects', Object.keys(result).length);
    this.logger.debug('Found sobjects: %j', result);
    return result;
  }

  async getObjectTypes() {
    return this.getSObjectList('updateable/createable sobject', object => object.updateable && object.createable);
  }

  async getCreateableObjectTypes() {
    return this.getSObjectList('createable sobject', object => object.createable);
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
          this.logger.info('Result: %j', result);
          this.logger.info('Total in database=%s', response.totalSize);
          this.logger.info('Total fetched=%s', response.totalFetched);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(err);
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
            this.logger.info('Ready batch: %j', batch);
            results.push(batch);
            batch = [];
          }
        })
        .on('end', () => {
          if (batch.length > 0) {
            this.logger.info('Last batch: %j', batch);
            results.push(batch);
          }
          this.logger.info('Total in database=%s', response.totalSize);
          this.logger.info('Total fetched=%s', response.totalFetched);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(err);
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
          this.logger.info('Emitting record: %j', record);
          results.push(record);
        })
        .on('end', () => {
          this.logger.info('Total in database=%s', response.totalSize);
          this.logger.info('Total fetched=%s', response.totalFetched);
          resolve();
        })
        .on('error', (err) => {
          this.logger.error(err);
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
        this.logger.error(err);
        this.emit('error', err);
      })
      .execute({ autoFetch: true, maxFetch });
    return results;
  }
}
module.exports.SalesForceClient = SalesForceClient;
