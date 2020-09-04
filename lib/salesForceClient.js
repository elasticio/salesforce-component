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
}
module.exports.SalesForceClient = SalesForceClient;
