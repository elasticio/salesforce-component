'use strict';
const messages = require('elasticio-node').messages;

const { Readable } = require('stream');
const requestPromise = require('request-promise');
const debug = require('debug')('salesforce:bulk');
const jsforce = require('jsforce');

const MetaLoader = require('../helpers/metaLoader');
const common = require('../common.js');


exports.objectTypes = async function (configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return await metaLoader.getObjectTypes();
};


exports.process = async function (message, configuration) {
  console.log('Starting bulk');

  const conn = new jsforce.Connection({
    oauth2: {
      clientId: process.env.SALESFORCE_KEY,
      clientSecret: process.env.SALESFORCE_SECRET,
      redirectUri: 'https://app.elastic.io/oauth/v2',
    },
    instanceUrl: configuration.oauth.instance_url,
    accessToken: configuration.oauth.access_token,
    refreshToken: configuration.oauth.refresh_token,
    version: common.globalConsts.SALESFORCE_API_VERSION,
  });
  conn.on('refresh', (accessToken, res) => {
    console.log('Keys were updated, res=%j', res);
    this.emit('updateKeys', {oauth: res});
  });

  // Get CSV from attachment
  let key;
  for (key in message.attachments) {
    break;
  }

  if (!key) {
    throw 'Attachment not found.';
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
  // Bulk load operation ('insert', 'update', 'delete')
  const job = conn.bulk.createJob(configuration.sobject, configuration.operation); // , {allowBulk: true, bulkThreshold: 0}
  const batch = job.createBatch();

  return new Promise((resolve, reject) => {
    // Upload CSV to SF
    batch.execute(csvStream)
      .on('queue', function (batchInfo) {
        // Check while job status become JobComplete or Failed, Aborted
        batch.poll(1000, 20000);
      }).on('response', function (rets) {
        // Retrieve the results of the completed job
        // emit results
        const out = messages.newEmptyMessage();
        out.body = rets;
        resolve(out);
      }).on('error', function (err) {
        console.log('Job error', err);
        throw err;
      });
  });
}

