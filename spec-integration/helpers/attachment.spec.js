/* eslint-disable no-return-assign */
const fs = require('fs');
const logger = require('@elastic.io/component-logger')();
const { expect } = require('chai');
const nock = require('nock');
const { prepareBinaryData } = require('../../lib/helpers/attachment');

describe('attachment helper test', async () => {
  const secretId = 'secretId';
  let configuration;
  let secret;

  before(async () => {
    if (fs.existsSync('.env')) {
      // eslint-disable-next-line global-require
      require('dotenv').config();
    }
    process.env.ELASTICIO_API_URI = 'https://app.example.io';
    process.env.ELASTICIO_WORKSPACE_ID = 'workspaceId';
    secret = {
      data: {
        attributes: {
          credentials: {
            access_token: process.env.ACCESS_TOKEN,
            instance_url: process.env.INSTANCE_URL,
          },
        },
      },
    };

    configuration = {
      secretId,
      sobject: 'Document',
    };
  });
  describe('prepareBinaryData test', async () => {
    it('should discard attachment utilizeAttachment:false', async () => {
      nock(process.env.ELASTICIO_API_URI)
        .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}`)
        .reply(200, secret);
      const msg = {
        body: {
          Name: 'TryTest',
        },
        attachments: {
          'Fox.jpeg': {
            'content-type': 'image/jpeg',
            size: 126564,
            url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
          },
        },
      };
      await prepareBinaryData(msg, { ...configuration, utilizeAttachment: false }, { logger });
      expect(msg.body.Name).to.eql('TryTest');
      expect(Object.prototype.hasOwnProperty.call(msg.body, 'Body')).to.eql(false);
    });

    it('should upload attachment utilizeAttachment:true', async () => {
      nock(process.env.ELASTICIO_API_URI)
        .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}`)
        .reply(200, secret);
      const msg = {
        body: {
          Name: 'TryTest',
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
      expect(msg.body.Name).to.eql('TryTest');
      expect(msg.body.ContentType).to.eql('image/jpeg');
      expect(Object.prototype.hasOwnProperty.call(msg.body, 'Body')).to.eql(true);
    });
  });
});
