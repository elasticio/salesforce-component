const { messages } = require('elasticio-node');
const util = require('../util');

const { Readable } = require('stream');
//const requestPromise = require('request-promise');

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
    default: {
      // 'delete' operation or anything else
      return metaLoader.getObjectTypes();
    }
  }
};


exports.process = async function bulkCUD(message, configuration) {
  this.logger.debug('Starting:', configuration.operation);

  const conn = sfConnection.createConnection(configuration, this);

  // Bulk operation ('insert', 'update', 'delete')
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

  // const options = {
  //   uri: message.attachments[key].url,
  //   method: 'GET',
  // };

  let result = await util.downloadAttachment(message.attachments[key].url);

  //const response = await requestPromise(options);

  const csvStream = new Readable();
  csvStream.push(result);
  csvStream.push(null);

  // Create job
  const job = conn.bulk.createJob(configuration.sobject, configuration.operation);
  const batch = job.createBatch();

  return new Promise((resolve, reject) => {
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
        reject(new Error(err.message));
        throw Error(`Job error: ${err.message}`);
      });
  });
};
