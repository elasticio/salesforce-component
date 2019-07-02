/* eslint-disable no-unused-vars */
const sinon = require('sinon');
const { expect } = require('chai');
const jsforce = require('jsforce');

const polling = require('../../lib/entry');

const configuration = {
  apiVersion: '39.0',
  oauth: {
    issued_at: '1541510572760',
    token_type: 'Bearer',
    id: 'https://login.salesforce.com/id/11/11',
    instance_url: 'https://example.com',
    id_token: 'ddd',
    scope: 'refresh_token full',
    signature: '=',
    refresh_token: 'refresh_token',
    access_token: 'access_token',
  },
  object: 'Contact',
};
const message = {
  body: {},
};
const snapshot = {};
let emitter;
let conn;
const records = require('../testData/trigger.results.json');


describe('Polling trigger test', () => {
  beforeEach(() => {
    emitter = {
      emit: sinon.spy(),
    };
  });

  afterEach(() => {
    sinon.restore();
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

  it('should be called with arg error', async () => {
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
