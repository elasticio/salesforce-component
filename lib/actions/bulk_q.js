const { messages } = require('elasticio-node');
const client = require('elasticio-rest-node')();

const request = require('request');

const sfConnection = require('../helpers/sfConnection.js');


exports.process = async function bulkQuery(message, configuration) {
  this.logger.error('Starting: query');

  const conn = sfConnection.createConnection(configuration, this);

  const signedUrl = await client.resources.storage.createSignedUrl();

  const out = messages.newEmptyMessage();
  out.attachments = {
    'bulk_query.csv': {
      'content-type': 'text/csv',
      url: signedUrl.get_url,
    },
  };
  out.body = {};

  return new Promise((resolve, reject) => {
    // Bulk operation ('query')
    const stream = conn.bulk.query(message.body.query)
      .on('error', (err) => {
        this.logger.warn('Bulk query error');
        reject(err);
      })
      .stream();

    // upload csv attachment
    stream.pipe(request.put(signedUrl.put_url, (err, resp, body) => {
      if (err) {
        this.logger.warn('Stream.pipe upload error');
        reject(err);
      } else {
        this.logger.debug('success');
        out.body = { result: body };
        resolve(out);
      }
    }));
  });
};
