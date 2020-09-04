/* eslint-disable no-return-assign */
const fs = require('fs');
const logger = require('@elastic.io/component-logger')();
const { expect } = require('chai');
const nock = require('nock');
const action = require('../../lib/actions/raw');

describe('raw action', async () => {
  const secretId = 'secretId';
  let configuration;
  let secret;
  let invalidSecret;

  before(async () => {
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

  it('process should succeed', async () => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}`)
      .reply(200, secret);
    const result = await action.process.call({ logger }, {}, configuration);
    expect(result.body.result).to.eql(true);
  });

  it('process should refresh', async () => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}`)
      .reply(200, invalidSecret)
      .post(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}/refresh`)
      .reply(200, secret);
    const result = await action.process.call({ logger }, {}, configuration);
    expect(result.body.result).to.eql(true);
  });
});
