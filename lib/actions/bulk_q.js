'use strict';
const messages = require('elasticio-node').messages;
const client = require('elasticio-rest-node')();

const request = require('request');
const debug = require('debug')('salesforce:bulk');

const sfConnection = require('../helpers/sfConnection.js');



exports.process = async function (message, configuration) {
  console.log('Starting bulk');

  const conn = sfConnection.createConnection(configuration, this);

  const signedUrl = await client.resources.storage.createSignedUrl();

  // Bulk operation ('query')
  const stream = conn.bulk.query(message.body.query).stream();

  await new Promise((resolve, reject) => {
    stream.pipe(request.put(signedUrl.put_url, function (err, resp, body) {
      resolve(body);
    }));
  });

  const out = messages.newEmptyMessage();
  out.attachments = {
    'bulk_query.csv': {
      'content-type': 'text/csv',
      'url': signedUrl.get_url
    }
  }
  out.body = {
    cfgIn: configuration,
    msgIn: message,
    att: out.attachments
  };

  return out;
}
