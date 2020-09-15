/* eslint-disable no-unused-vars */
const fs = require('fs');
const sinon = require('sinon');
const { expect } = require('chai');
const jsforce = require('jsforce');
const nock = require('nock');
const logger = require('@elastic.io/component-logger')();

const polling = require('../../lib/entry');

const message = {
  body: {},
};
const snapshot = {};
let conn;
const records = require('../testData/trigger.results.json');


describe('Polling trigger test', () => {
  let emitter;
  const secretId = 'secretId';
  let configuration;
  let secret;

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

    configuration = {
      secretId,
      object: 'Contact',
    };

    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}`)
      .times(10)
      .reply(200, secret);
  });

  beforeEach(() => {
    emitter = {
      emit: sinon.spy(),
      logger,
    };
  });

  afterEach(() => {
    jsforce.Connection.restore();
  });

  it('should be called with arg data five times', async () => {
    conn = sinon.stub(jsforce, 'Connection').callsFake(() => {
      const connStub = {
        sobject() {
          return connStub;
        },
        on() {
          return connStub;
        },
        select() {
          return connStub;
        },
        where() {
          return connStub;
        },
        sort() {
          return connStub;
        },
        execute() {
          return records;
        },
      };
      return connStub;
    });
    await polling
      .process.call(emitter, message, configuration, snapshot);
    expect(emitter.emit.withArgs('data').callCount).to.be.equal(records.length);
    expect(emitter.emit.withArgs('snapshot').callCount).to.be.equal(1);
    expect(emitter.emit.withArgs('snapshot').getCall(0).args[1].previousLastModified).to.be.equal(records[records.length - 1].LastModifiedDate);
  });

  it('should not be called with arg data and snapshot', async () => {
    conn = sinon.stub(jsforce, 'Connection').callsFake(() => {
      const connStub = {
        sobject() {
          return connStub;
        },
        on() {
          return connStub;
        },
        select() {
          return connStub;
        },
        where() {
          return connStub;
        },
        sort() {
          return connStub;
        },
        execute() {
          return [];
        },
      };
      return connStub;
    });
    await polling
      .process.call(emitter, message, configuration, snapshot);
    expect(emitter.emit.withArgs('data').callCount).to.be.equal(0);
    expect(emitter.emit.withArgs('snapshot').callCount).to.be.equal(0);
  });

  it('should not be called with arg data', async () => {
    conn = sinon.stub(jsforce, 'Connection').callsFake(() => {
      const connStub = {
        sobject() {
          return connStub;
        },
        on() {
          return connStub;
        },
        select() {
          return connStub;
        },
        where() {
          return connStub;
        },
        sort() {
          return connStub;
        },
        execute(cfg, processResults) {
          return connStub;
        },
      };
      return connStub;
    });
    snapshot.previousLastModified = '2019-28-03T00:00:00.000Z';
    await polling
      .process.call(emitter, message, configuration, snapshot);
    expect(emitter.emit.withArgs('data').callCount).to.be.equal(0);
    expect(emitter.emit.withArgs('snapshot').callCount).to.be.equal(0);
  });

  it.skip('should be called with arg error', async () => {
    conn = sinon.stub(jsforce, 'Connection').callsFake(() => {
      const connStub = {
        sobject() {
          return connStub;
        },
        on() {
          return connStub;
        },
        select() {
          return connStub;
        },
        where() {
          return connStub;
        },
        sort() {
          return connStub;
        },
        execute() {
          return [];
        },
      };
      return connStub;
    });
    snapshot.previousLastModified = '2019-28-03T00:00:00.000Z';
    configuration.sizeOfPollingPage = 'test';
    await polling
      .process.call(emitter, message, configuration, snapshot);
    expect(emitter.emit.withArgs('error').callCount).to.be.equal(1);
    expect(emitter.emit.withArgs('data').callCount).to.be.equal(0);
    expect(emitter.emit.withArgs('snapshot').callCount).to.be.equal(0);
  });
});
