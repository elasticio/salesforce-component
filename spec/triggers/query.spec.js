const chai = require('chai');
const nock = require('nock');
const sinon = require('sinon');
const logger = require('@elastic.io/component-logger')();

const { expect } = chai;

const common = require('../../lib/common.js');
const testCommon = require('../common.js');

const queryObjects = require('../../lib/triggers/query.js');

// Disable real HTTP requests
nock.disableNetConnect();

describe('Query module: processTrigger', () => {
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

  beforeEach(() => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}`)
      .times(5)
      .reply(200, testCommon.secret);
  });

  afterEach(() => {
    context.emit.resetHistory();
  });

  it('Gets objects emitAll', async () => {
    testCommon.configuration.query = 'select name, id from account where name = \'testtest\'';
    testCommon.configuration.outputMethod = 'emitAll';

    const expectedQuery = 'select%20name%2C%20id%20from%20account%20where%20name%20%3D%20%27testtest%27';

    const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${expectedQuery}`)
      .reply(200, { done: true, totalSize: testReply.result.length, records: testReply.result });

    await queryObjects.process.call(context, {}, testCommon.configuration);
    scope.done();
    expect(context.emit.getCall(0).lastArg.body.records).to.deep.equal(testReply.result);
  });

  it('Gets objects emitIndividually', async () => {
    testCommon.configuration.outputMethod = 'emitIndividually';
    testCommon.configuration.query = 'select name, id from account where name = \'testtest\'';

    const expectedQuery = 'select%20name%2C%20id%20from%20account%20where%20name%20%3D%20%27testtest%27';

    const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${expectedQuery}`)
      .reply(200, { done: true, totalSize: testReply.result.length, records: testReply.result });

    await queryObjects.process.call(context, {}, testCommon.configuration);
    scope.done();
    expect(context.emit.getCall(0).lastArg.body).to.deep.equal(testReply.result[0]);
  });
});
