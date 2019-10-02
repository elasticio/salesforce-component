'use strict';
const messages = require('elasticio-node').messages;

const { Readable } = require('stream');
const requestPromise = require('request-promise');
const debug = require('debug')('salesforce:bulk');

const MetaLoader = require('../helpers/metaLoader');
const sfConnection = require('../helpers/sfConnection.js');

const DEFAULT_TIMEOUT = 600; // 10 min

exports.objectTypes = async function (configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  switch (configuration.sobject) {
    case 'insert': {
      return metaLoader.getCreateableObjectTypes();
    }
    case 'update': {
      return metaLoader.getUpdateableObjectTypes();
    }
  }
  // 'delete' operation or anything else
  return metaLoader.getObjectTypes();
};


exports.process = async function (message, configuration) {
  debug('Starting bulk: ', configuration.operation);

  const conn = sfConnection.createConnection(configuration, this);

  // Bulk operation ('insert', 'update', 'delete')
  // Get CSV from attachment
  let key;
  for (key in message.attachments) {
    break;
  }

  if (!key) {
    throw 'Attachment not found.';
  }

  let timeout = parseInt(configuration.timeout);
  if (Number.isNaN(timeout) || (timeout < 0)) {
    debug('Timeout is incorrect. Set default value: ', DEFAULT_TIMEOUT);
    timeout = DEFAULT_TIMEOUT;
  }

  const options = {
    uri: message.attachments[key]['url'],
    method: 'GET',
  }
  const response = await requestPromise(options);

  const csvStream = new Readable();
  csvStream.push(response);
  csvStream.push(null);

  // Create job
  const job = conn.bulk.createJob(configuration.sobject, configuration.operation);
  const batch = job.createBatch();

  return new Promise((resolve, reject) => {
    // Upload CSV to SF
    batch.execute(csvStream)
      .on('queue', function (batchInfo) {
        // Check while job status become JobComplete or Failed, Aborted
        batch.poll(1000, timeout * 1000);
      }).on('response', function (rets) {
        // Retrieve the results of the completed job
        // emit results
        const out = messages.newEmptyMessage();
        out.body = rets;
        resolve(out);
      }).on('error', function (err) {
        debug('Job error', err);
        throw err;
      });
  });
}

