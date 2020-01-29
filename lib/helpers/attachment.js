const { Readable } = require('stream');
const mime = require('mime-types');
const request = require('request');
const requestPromise = require('request-promise');

const client = require('elasticio-rest-node')();

const MetaLoader = require('../helpers/metaLoader');


async function downloadFile(url, headers) {
  const optsDownload = {
    uri: url,
    method: 'GET',
    resolveWithFullResponse: true,
    encoding: null,
    headers,
  };

  const response = await requestPromise(optsDownload);
  return response.body;
}

exports.prepareBinaryData = async function prepareBinaryData(msg, configuration, sfConnection, emitter) {
  let binField;
  let attachment;

  if (msg.attachments && Object.keys(msg.attachments).length > 0) {
    [attachment] = Object.keys(msg.attachments);
  }

  // If there is an attachment then the binary data field is overwritten.
  if (attachment) {
    attachment = msg.attachments[attachment];

    emitter.logger.info('Found an attachment from the previous component.');

    if (configuration.utilizeAttachment) {
      const metaLoader = new MetaLoader(configuration, emitter, sfConnection);
      const objectFields = await metaLoader.getObjectFieldsMetaData();

      binField = objectFields.find(field => field.type === 'base64');

      if (binField) {
        emitter.logger.info('Preparing the attachment...');

        const data = await downloadFile(attachment.url);
        msg.body[binField.name] = Buffer.from(data).toString('base64');

        if (attachment['content-type'] && objectFields.find(field => field.name === 'ContentType')) {
          msg.body.ContentType = attachment['content-type'];
        }
      } else {
        emitter.logger.info(`${configuration.sobject} object does not have a field for binary data. The attachment is discarded.`);
      }
    } else {
      emitter.logger.info('The attachment will be discarded.');
    }
  }

  return binField;
};

exports.getAttachment = async function getAttachment(configuration, objectContent, sfConnection, emitter) {
  const metaLoader = new MetaLoader(configuration, emitter, sfConnection);
  const objectFields = await metaLoader.getObjectFieldsMetaData();

  const binField = objectFields.find(field => field.type === 'base64');
  if (!binField) return;

  const binDataUrl = objectContent[binField.name];
  if (!binDataUrl) return;

  const data = await downloadFile(configuration.oauth.instance_url + binDataUrl, {
    Authorization: 'Bearer ' + sfConnection.accessToken
  });

  const signedUrl = await client.resources.storage.createSignedUrl();

  const stream = new Readable();
  stream.push(data);
  stream.push(null);
  await stream.pipe(request.put(signedUrl.put_url));

  let fileName = objectContent.Name;
  const contentType = objectContent.ContentType;

  if (!fileName) {
    fileName = 'attachment';
  } else if (contentType) {
    const fileExtension = mime.extension(contentType);
    if (fileExtension) {
      fileName = `${fileName}.${fileExtension}`;
    }
  }

  const attachment = {
    [fileName]: {
      url: signedUrl.get_url,
    },
  };

  if (contentType) {
    attachment[fileName]['content-type'] = contentType;
  }

  return attachment;
};
