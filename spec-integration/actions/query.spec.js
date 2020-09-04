/* eslint-disable no-return-assign */
const fs = require('fs');
const logger = require('@elastic.io/component-logger')();
const { expect } = require('chai');
const sinon = require('sinon');
const nock = require('nock');
const action = require('../../lib/actions/query');

describe('query action', async () => {
  let emitter;
  const secretId = 'secretId';
  let configuration;
  let secret;
  let invalidSecret;
  const message = {
    body: {
      query: 'SELECT Id, Name FROM Contact limit 10',
    },
  };

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
            instance_url: process.env.INSTANCE_URL,
          },
        },
      },
    };
    invalidSecret = {
      data: {
        attributes: {
          credentials: {
            access_token: 'access_token',
            instance_url: process.env.INSTANCE_URL,
          },
        },
      },
    };

    configuration = {
      secretId,
    };
  });
  afterEach(() => {
    emitter.emit.resetHistory();
  });

  it('should succeed query allowResultAsSet', async () => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}`)
      .reply(200, secret);
    await action.process.call(emitter, message, { ...configuration, allowResultAsSet: true });
    expect(emitter.emit.callCount).to.eql(1);
    expect(emitter.emit.args[0][0]).to.eql('data');
    expect(emitter.emit.args[0][1].body.result.length).to.eql(10);
  });

  it('should succeed query batchSize', async () => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}`)
      .reply(200, secret);
    await action.process.call(emitter, message, { ...configuration, batchSize: 3 });
    expect(emitter.emit.callCount).to.eql(4);
    expect(emitter.emit.args[0][0]).to.eql('data');
    expect(emitter.emit.args[0][1].body.result.length).to.eql(3);
  });

  it('should refresh token query', async () => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}`)
      .reply(200, invalidSecret)
      .post(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}/refresh`)
      .reply(200, secret);
    await action.process.call(emitter, message, configuration);
    expect(emitter.emit.callCount).to.eql(10);
    expect(emitter.emit.args[0][0]).to.eql('data');
  });
});
