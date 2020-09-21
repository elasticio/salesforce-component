const { messages } = require('elasticio-node');
const client = require('elasticio-rest-node')();
const request = require('request');
const { callJSForceMethod } = require('../helpers/wrapper');

exports.process = async function bulkQuery(message, configuration) {
  this.logger.info('Starting Bulk Query action');
  const signedUrl = await client.resources.storage.createSignedUrl();
  const out = messages.newEmptyMessage();
  out.attachments = {
    'bulk_query.csv': {
      'content-type': 'text/csv',
      url: signedUrl.get_url,
    },
  };
  out.body = {};
  const stream = await callJSForceMethod.call(this, configuration, 'bulkQuery', message.body.query);
  return new Promise((resolve, reject) => {
    stream.pipe(request.put(signedUrl.put_url, (err, resp, body) => {
      if (err) {
        this.logger.error('Error upload query results');
        reject(err);
      } else {
        this.logger.info('Action successfully processed');
        out.body = { result: body };
        resolve(out);
      }
    }));
  });
};
