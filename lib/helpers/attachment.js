'use strict';

const requestPromise = require('request-promise');
const MetaLoader = require('../helpers/metaLoader');

exports.prepareBinaryData = async function(msg, configuration, sfConnection) {
  let binField;
  let attachment;
  for (attachment in msg.attachments) break;

  // If there is an attachment then the binary data field is overwritten.
  if (attachment) {
    attachment = msg.attachments[attachment];

    console.log("Found an attachment from the previous component.");

    if (configuration.utilizeAttachment) {
      const metaLoader = new MetaLoader(configuration, this, sfConnection);
      const objectFields = await metaLoader.getObjectFieldsMetaData();

      binField = objectFields.find(field => field.type === "base64");

      if (binField) {
        console.log("Preparing the attachment...");

        const optsDownload = {
          uri: attachment['url'],
          method: 'GET',
          resolveWithFullResponse: true,
          encoding: null
        }
        const response = await requestPromise(optsDownload);
        msg.body[binField.name] = Buffer.from(response.body).toString('base64');

        if (attachment["content-type"] && objectFields.find(field => field.name === "ContentType"))
          msg.body.ContentType = attachment["content-type"];

      } else {
        console.log(`${configuration.sobject} object does not have a field for binary data. The attachment is discarded.`);
      }
    } else {
      console.log("The attachment will be discarded.");
    }
  }

  return binField;
}
