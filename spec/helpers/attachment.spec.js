const { expect } = require('chai');
const nock = require('nock');
const logger = require('@elastic.io/component-logger')();
const common = require('../../lib/common.js');
const testCommon = require('../common.js');
const { prepareBinaryData, getAttachment } = require('../../lib/helpers/attachment');

describe('attachment helper', () => {
  beforeEach(() => {
    nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
      .reply(200, {
        fields: [
          {
            name: 'Body',
            type: 'base64',
          },
          {
            name: 'ContentType',
          },
        ],
      });
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}`)
      .times(2)
      .reply(200, testCommon.secret);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  const configuration = {
    secretId: testCommon.secretId,
    sobject: 'Document',
  };

  describe('prepareBinaryData test', () => {
    it('should upload attachment utilizeAttachment:true', async () => {
      const msg = {
        body: {
          Name: 'Attachment',
        },
        attachments: {
          'Fox.jpeg': {
            'content-type': 'image/jpeg',
            size: 126564,
            url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
          },
        },
      };
      await prepareBinaryData(msg, { ...configuration, utilizeAttachment: true }, { logger });
      expect(msg.body.Name).to.eql('Attachment');
      expect(msg.body.ContentType).to.eql('image/jpeg');
      expect(Object.prototype.hasOwnProperty.call(msg.body, 'Body')).to.eql(true);
    });

    it('should discard attachment utilizeAttachment:false', async () => {
      const msg = {
        body: {
          Name: 'Without Attachment',
        },
        attachments: {
          'Fox.jpeg': {
            'content-type': 'image/jpeg',
            size: 126564,
            url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
          },
        },
      };
      await prepareBinaryData(msg, configuration, { logger });
      expect(msg.body.Name).to.eql('Without Attachment');
      expect(Object.prototype.hasOwnProperty.call(msg.body, 'Body')).to.eql(false);
    });
  });

  describe.skip('getAttachment test', async () => {
    it('should getAttachment', async () => {
      nock(testCommon.instanceUrl)
        .get('/services/data/v46.0/sobjects/Attachment/00P2R00001DYjNVUA1/Body')
        .reply(200, { hello: 'world' });
      const objectContent = {
        Body: '/services/data/v46.0/sobjects/Attachment/00P2R00001DYjNVUA1/Body',
      };
      const result = await getAttachment(configuration, objectContent, { logger });
      expect(result).to.eql({
        attachment: {
          url: 'http://file.storage.server',
        },
      });
    });
  });
});
