/* eslint-disable max-len */
const sinon = require('sinon');
const { expect } = require('chai');
const nock = require('nock');
const logger = require('@elastic.io/component-logger')();
const testCommon = require('../common.js');
const common = require('../../lib/common.js');
const polling = require('../../lib/entry');
const records = require('../testData/trigger.results.json');
const metaModelDocumentReply = require('../testData/sfDocumentMetadata.json');

const configuration = {
  secretId: testCommon.secretId,
  object: 'Document',
};
const message = {
  body: {},
};
const snapshot = {};
let emitter;

describe('Polling trigger test', () => {
  beforeEach(() => {
    emitter = {
      emit: sinon.spy(),
      logger,
    };
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}`)
      .times(3)
      .reply(200, testCommon.secret);
    nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
      .times(3)
      .reply(200, metaModelDocumentReply);
  });
  afterEach(() => {
    nock.cleanAll();
  });

  it('should be called with arg data five times', async () => {
    const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=SELECT%20Id%2C%20FolderId%2C%20IsDeleted%2C%20Name%2C%20DeveloperName%2C%20NamespacePrefix%2C%20ContentType%2C%20Type%2C%20IsPublic%2C%20BodyLength%2C%20Body%2C%20Url%2C%20Description%2C%20Keywords%2C%20IsInternalUseOnly%2C%20AuthorId%2C%20CreatedDate%2C%20CreatedById%2C%20LastModifiedDate%2C%20LastModifiedById%2C%20SystemModstamp%2C%20IsBodySearchable%2C%20LastViewedDate%2C%20LastReferencedDate%20FROM%20Document%20WHERE%20LastModifiedDate%20%3E%3D%201970-01-01T00%3A00%3A00.000Z%20ORDER%20BY%20LastModifiedDate%20ASC`)
      .reply(200, { done: true, totalSize: 5, records });
    await polling.process.call(emitter, message, configuration, snapshot);
    expect(emitter.emit.withArgs('data').callCount).to.be.equal(records.length);
    expect(emitter.emit.withArgs('snapshot').callCount).to.be.equal(1);
    expect(emitter.emit.withArgs('snapshot').getCall(0).args[1].previousLastModified).to.be.equal(records[records.length - 1].LastModifiedDate);
    scope.done();
  });

  it('should not be called with arg data and snapshot', async () => {
    const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=SELECT%20Id%2C%20FolderId%2C%20IsDeleted%2C%20Name%2C%20DeveloperName%2C%20NamespacePrefix%2C%20ContentType%2C%20Type%2C%20IsPublic%2C%20BodyLength%2C%20Body%2C%20Url%2C%20Description%2C%20Keywords%2C%20IsInternalUseOnly%2C%20AuthorId%2C%20CreatedDate%2C%20CreatedById%2C%20LastModifiedDate%2C%20LastModifiedById%2C%20SystemModstamp%2C%20IsBodySearchable%2C%20LastViewedDate%2C%20LastReferencedDate%20FROM%20Document%20WHERE%20LastModifiedDate%20%3E%3D%201970-01-01T00%3A00%3A00.000Z%20ORDER%20BY%20LastModifiedDate%20ASC`)
      .reply(200, { done: true, totalSize: 0, records: [] });
    await polling
      .process.call(emitter, message, configuration, snapshot);
    expect(emitter.emit.withArgs('data').callCount).to.be.equal(0);
    expect(emitter.emit.withArgs('snapshot').callCount).to.be.equal(0);
    scope.done();
  });

  it('should not be called with arg data', async () => {
    const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=SELECT%20Id%2C%20FolderId%2C%20IsDeleted%2C%20Name%2C%20DeveloperName%2C%20NamespacePrefix%2C%20ContentType%2C%20Type%2C%20IsPublic%2C%20BodyLength%2C%20Body%2C%20Url%2C%20Description%2C%20Keywords%2C%20IsInternalUseOnly%2C%20AuthorId%2C%20CreatedDate%2C%20CreatedById%2C%20LastModifiedDate%2C%20LastModifiedById%2C%20SystemModstamp%2C%20IsBodySearchable%2C%20LastViewedDate%2C%20LastReferencedDate%20FROM%20Document%20WHERE%20LastModifiedDate%20%3E%202019-28-03T00%3A00%3A00.000Z%20ORDER%20BY%20LastModifiedDate%20ASC`)
      .reply(200, { done: true, totalSize: 5, records: [] });
    snapshot.previousLastModified = '2019-28-03T00:00:00.000Z';
    await polling
      .process.call(emitter, message, configuration, snapshot);
    expect(emitter.emit.withArgs('data').callCount).to.be.equal(0);
    expect(emitter.emit.withArgs('snapshot').callCount).to.be.equal(0);
    scope.done();
  });
});
