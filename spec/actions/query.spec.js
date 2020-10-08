const chai = require('chai');
const nock = require('nock');
const sinon = require('sinon');
const logger = require('@elastic.io/component-logger')();

const { expect } = chai;

const common = require('../../lib/common.js');
const testCommon = require('../common.js');

const queryObjects = require('../../lib/actions/query.js');

describe('Query module: processAction', () => {
  const context = { emit: sinon.spy(), logger };

  const testReply = {
    result: [
      {
        Id: 'testObjId',
        FolderId: 'xxxyyyzzz',
        Name: 'NotVeryImportantDoc',
        IsPublic: false,
        Body: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
        ContentType: 'imagine/noHeaven',
      },
      {
        Id: 'testObjId',
        FolderId: '123yyyzzz',
        Name: 'VeryImportantDoc',
        IsPublic: true,
        Body: 'wikipedia.org',
        ContentType: 'imagine/noHell',
      },
    ],
  };
  const message = {
    body: {
      query: 'select name, id from account where name = \'testtest\'',
    },
  };
  const expectedQuery = 'select%20name%2C%20id%20from%20account%20where%20name%20%3D%20%27testtest%27';

  beforeEach(() => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}`)
      .reply(200, testCommon.secret);
  });

  afterEach(() => {
    nock.cleanAll();
    context.emit.resetHistory();
  });

  it('Gets objects not including deleted', async () => {
    const configuration = {
      ...testCommon.configuration,
      includeDeleted: false,
      allowResultAsSet: true,
    };
    const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${expectedQuery}`)
      .reply(200, { done: true, totalSize: testReply.result.length, records: testReply.result });

    await queryObjects.process.call(context, message, configuration);
    scope.done();
    expect(context.emit.getCall(0).lastArg.body).to.deep.equal(testReply);
  });

  it('Gets objects including deleted', async () => {
    const configuration = {
      ...testCommon.configuration,
      includeDeleted: true,
      allowResultAsSet: true,
    };
    const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/queryAll?q=${expectedQuery}`)
      .reply(200, { done: true, totalSize: testReply.result.length, records: testReply.result });

    await queryObjects.process.call(context, message, configuration);
    scope.done();
    expect(context.emit.getCall(0).lastArg.body).to.deep.equal(testReply);
  });

  it('Gets objects batchSize=1, allowResultAsSet = false', async () => {
    const configuration = {
      ...testCommon.configuration,
      includeDeleted: true,
      allowResultAsSet: false,
      batchSize: 1,
    };
    const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/queryAll?q=${expectedQuery}`)
      .reply(200, { done: true, totalSize: testReply.result.length, records: testReply.result });

    await queryObjects.process.call(context, message, configuration);
    scope.done();
    expect(context.emit.getCalls().length).to.be.equal(2);
    expect(context.emit.getCall(0).lastArg.body).to.deep.equal({ result: [testReply.result[0]] });
    expect(context.emit.getCall(1).lastArg.body).to.deep.equal({ result: [testReply.result[1]] });
  });

  it('Gets objects batchSize=1, allowResultAsSet = true', async () => {
    const configuration = {
      ...testCommon.configuration,
      includeDeleted: true,
      allowResultAsSet: true,
    };
    const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/queryAll?q=${expectedQuery}`)
      .reply(200, { done: true, totalSize: testReply.result.length, records: testReply.result });

    await queryObjects.process.call(context, message, configuration);
    scope.done();
    expect(context.emit.getCalls().length).to.be.equal(1);
    expect(context.emit.getCall(0).lastArg.body).to.deep.equal(testReply);
  });

  it('Gets objects batchSize=0, allowResultAsSet = false', async () => {
    const configuration = {
      ...testCommon.configuration,
      includeDeleted: true,
      allowResultAsSet: undefined,
      batchSize: 0,
    };
    const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/queryAll?q=${expectedQuery}`)
      .reply(200, { done: true, totalSize: testReply.result.length, records: testReply.result });

    await queryObjects.process.call(context, message, configuration);
    scope.done();
    expect(context.emit.getCalls().length).to.be.equal(2);
    expect(context.emit.getCall(0).lastArg.body).to.deep.equal(testReply.result[0]);
    expect(context.emit.getCall(1).lastArg.body).to.deep.equal(testReply.result[1]);
  });
});
