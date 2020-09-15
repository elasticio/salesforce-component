/* eslint-disable no-return-assign,no-unused-expressions */
const fs = require('fs');
const sinon = require('sinon');
const chai = require('chai');
const nock = require('nock');
const logger = require('@elastic.io/component-logger')();
const deleteObject = require('../../lib/actions/deleteObject');
// const { testDataFactory } = require('../../lib/helpers/deleteObjectHelpers.js');

const { expect } = chai;

describe('Delete Object Integration Functionality', () => {
  let emitter;
  let testObjLst;
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
            instance_url: process.env.INSTANCE_URL,
          },
        },
      },
    };

    configuration = {
      secretId,
      sobject: 'Contact',
    };

    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${secretId}`)
      .times(10)
      .reply(200, secret);
  });

  beforeEach(() => {
    emitter.emit.resetHistory();
  });

  it('Delete object by Id my config', async () => {
    const message = {
      body: {
        Id: '0032R00002AHsqLQAT',
      },
    };
    const result = await deleteObject.process.call(emitter, message, { ...configuration, lookupField: 'Id' });
    expect(result.body.id).to.be.eq('id');
  });

  it('Correctly identifies a lack of response on a non-existent Contact', async () => {
    await deleteObject.process.call(emitter, testObjLst[0].message, testObjLst[0].config);
    expect(emitter.emit.args[2][1].body).to.be.empty;
  });

  it('Correctly deletes an existent Contact', async () => {
    const testObj = await deleteObject.process.call(
      emitter, testObjLst[1].message, testObjLst[1].config,
    );
    expect(emitter.emit.args[2][1].body).to.be.deep.equal(testObj.response);
  });

  it('Correctly identifies when more than one object is found and throws', async () => {
    await deleteObject.process.call(emitter, testObjLst[2].message, testObjLst[2].config);
    expect(emitter.emit.args[2][1]).to.be.instanceOf(Error);
  });

  it('Correctly deletes based on different criteria: allFields ( Date/Time )', async () => {
    const testObj = await deleteObject.process.call(
      emitter, testObjLst[3].message, testObjLst[3].config,
    );
    expect(emitter.emit.args[2][1].body).to.be.deep.equal(testObj.response);
  });
});
