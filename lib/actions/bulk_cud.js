const { messages } = require('elasticio-node');

const { Readable } = require('stream');
const requestPromise = require('request-promise');

const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');

const DEFAULT_TIMEOUT = 600; // 10 min


exports.objectTypes = async function objectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  switch (configuration.sobject) {
    case 'insert': {
      return metaLoader.getCreateableObjectTypes();
    }
    case 'update': {
      return metaLoader.getUpdateableObjectTypes();
    }
    case 'upsert': {
      return metaLoader.getObjectTypes();
    }
    default: {
      // 'delete' operation or anything else
      return metaLoader.getObjectTypes();
    }
  }
};


exports.process = async function bulkCUD(message, configuration) {
  this.logger.debug('Starting:', configuration.operation);

  const conn = sfConnection.createConnection(configuration, this);

  // Bulk operation ('insert', 'update', 'delete', 'upsert')
  // Get CSV from attachment
  if (!message.attachments || Object.keys(message.attachments).length === 0) {
    this.logger.error('Attachment not found');
    return messages.newMessageWithBody({ });
  }

  const key = Object.keys(message.attachments)[0];

  let timeout = parseInt(configuration.timeout, 10);
  if (Number.isNaN(timeout) || (timeout < 0)) {
    this.logger.warn(`Timeout is incorrect. Set default value: ${DEFAULT_TIMEOUT} sec.`);
    timeout = DEFAULT_TIMEOUT;
  }

  const options = {
    uri: message.attachments[key].url,
    method: 'GET',
  };
  const response = await requestPromise(options);

  const csvStream = new Readable();
  csvStream.push(response);
  csvStream.push(null);

  let extra;
  if (configuration.operation === 'upsert') {
    extra = { extIdField: message.body.extIdField };
  }
  // Create job
  const job = conn.bulk.createJob(configuration.sobject, configuration.operation, extra);
  const batch = job.createBatch();

  return new Promise((resolve) => {
    // Upload CSV to SF
    batch.execute(csvStream)
      // eslint-disable-next-line no-unused-vars
      .on('queue', (batchInfo) => {
        // Check while job status become JobComplete or Failed, Aborted
        batch.poll(1000, timeout * 1000);
      }).on('response', (rets) => {
        // Retrieve the results of the completed job
        // emit results
        this.logger.debug('Result receiver. Records count:', rets.length);
        const out = messages.newEmptyMessage();
        out.body = { result: rets };
        resolve(out);
      }).on('error', (err) => {
        this.logger.error('Job error', err.message);
        resolve({ });
        throw Error(`Job error: ${err.message}`);
      });
  });
};


exports.getMetaModel = async function getMetaModel(configuration) {
  const meta = {
    in: {
      type: 'object',
      properties: {},
    },
    out: {
      type: 'object',
      properties: {
        result: {
          type: 'array',
          properties: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
              },
              success: {
                type: 'boolean',
              },
              errors: {
                type: 'array',
              },
            },
          },
        },
      },
    },
  };
  if (configuration.operation === 'upsert') {
    meta.in.properties.extIdField = {
      type: 'string',
      required: true,
      title: 'External ID Field',
    };
  }

  return meta;
};
