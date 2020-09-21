/* eslint-disable no-return-assign */
const fs = require('fs');
const sinon = require('sinon');
const { messages } = require('elasticio-node');
const logger = require('@elastic.io/component-logger')();
const polling = require('../../lib/entry');

describe('polling', () => {
  let message;
  let lastCall;
  let configuration;
  let snapshot;

  beforeEach(async () => {
    lastCall.reset();
  });

  before(async () => {
    if (fs.existsSync('.env')) {
      // eslint-disable-next-line global-require
      require('dotenv').config();
    }

    lastCall = sinon.stub(messages, 'newMessageWithBody')
      .returns(Promise.resolve());

    configuration = {
      apiVersion: '39.0',
      oauth: {
        instance_url: 'https://na38.salesforce.com',
        refresh_token: process.env.REFRESH_TOKEN,
        access_token: process.env.ACCESS_TOKEN,
      },
      object: 'Account',
    };
    message = {
      body: {},
    };
    snapshot = {};
  });

  after(async () => {
    messages.newMessageWithBody.restore();
  });

  const emitter = {
    emit: sinon.spy(),
    logger,
  };

  it('Account polling with empty snapshot', async () => {
    await polling
      .process.call(emitter, message, configuration, snapshot);
  });

  it('Account polling with not empty snapshot', async () => {
    snapshot = '2018-11-12T13:06:01.179Z';
    await polling
      .process.call(emitter, message, configuration, snapshot);
  });

  it('Account polling with not snapshot.previousLastModified', async () => {
    snapshot = { previousLastModified: '2018-11-12T13:06:01.179Z' };
    await polling
      .process.call(emitter, message, configuration, snapshot);
  });
});
