const chai = require('chai');
const nock = require('nock');
const sinon = require('sinon');
const logger = require('@elastic.io/component-logger')();

const { expect } = chai;

const common = require('../../lib/common.js');
const testCommon = require('../common.js');

const queryObjects = require('../../lib/triggers/query.js');

describe('Query module: processTrigger', () => {
  const context = { emit: sinon.spy(), logger };
  testCommon.configuration.query = 'select name, id from account where name = \'testtest\'';
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
  const expectedQuery = 'select%20name%2C%20id%20from%20account%20where%20name%20%3D%20%27testtest%27';
  beforeEach(() => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}`)
      .times(5)
      .reply(200, testCommon.secret);
    nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${expectedQuery}`)
      .reply(200, { done: true, totalSize: testReply.result.length, records: testReply.result });
  });

  afterEach(() => {
    nock.cleanAll();
    context.emit.resetHistory();
  });

  it('Gets objects emitAll', async () => {
    testCommon.configuration.outputMethod = 'emitAll';
    await queryObjects.process.call(context, {}, testCommon.configuration);
    expect(context.emit.getCall(0).lastArg.body.records).to.deep.equal(testReply.result);
  });

  it('Gets objects emitIndividually', async () => {
    testCommon.configuration.outputMethod = 'emitIndividually';
    await queryObjects.process.call(context, {}, testCommon.configuration);
    expect(context.emit.getCall(0).lastArg.body).to.deep.equal(testReply.result[0]);
  });
});
