/* eslint-disable no-return-assign */
const fs = require('fs');
const logger = require('@elastic.io/component-logger')();
const { expect } = require('chai');
const sinon = require('sinon');
const nock = require('nock');
const trigger = require('../../lib/triggers/streamPlatformEvents');

describe('streamPlatformEvents trigger test', async () => {
  let emitter;
  const secretId = 'secretId';
  let configuration;
  let secret;

  before(async () => {
    emitter = {
      emit: sinon.spy(),
      logger,
    };
    if (fs.existsSync('.env')) {
      // eslint-disable-next-line global-require
      require('dotenv').config();
    }
    process.env.ELASTICIO_API_URI = 'https://app.example.io';
    process.env.ELASTICIO_API_USERNAME = 'user';
    process.env.ELASTICIO_API_KEY = 'apiKey';
    process.env.ELASTICIO_WORKSPACE_ID = 'workspaceId';
    secret = {
      data: {
        attributes: {
          credentials: {
            access_token: process.env.ACCESS_TOKEN,
            undefined_params: {
              instance_url: process.env.INSTANCE_URL,
            },
          },
        },
      },
    };

    configuration = {
      secretId,
      object: 'Test__e',
    };

    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}`)
      .times(10)
      .reply(200, secret);
  });
  afterEach(() => {
    emitter.emit.resetHistory();
  });

  it('should succeed selectModel objectTypes', async () => {
    const result = await trigger.objectTypes.call(emitter, configuration);
    expect(result).to.eql({
      Test__e: 'Integration Test event',
      UserCreateAcknowledge__e: 'UserCreateAcknowledge',
    });
  });

  it('should succeed process trigger', async () => {
    await trigger.process.call(emitter, {}, configuration);
    expect(emitter.emit.callCount).to.eql(0);
  });
});
