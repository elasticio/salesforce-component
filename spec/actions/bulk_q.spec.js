/* eslint-disable guard-for-in,no-restricted-syntax */
const chai = require('chai');
const nock = require('nock');

const testCommon = require('../common.js');
const testData = require('../testData/bulk_q.json');
const bulk = require('../../lib/actions/bulk_q.js');

describe('Salesforce bulk query', () => {
  beforeEach(async () => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}`)
      .reply(200, testCommon.secret);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('action query', async () => {
    const data = testData.bulkQuery;
    data.configuration = { ...testCommon.configuration, ...data.configuration };
    const expectedResult = { 'bulk_query.csv': { 'content-type': 'text/csv', url: testCommon.EXT_FILE_STORAGE } };
    for (const host in data.responses) {
      for (const path in data.responses[host]) {
        nock(host)
          .intercept(path, data.responses[host][path].method)
          .reply(200, data.responses[host][path].response, data.responses[host][path].header);
      }
    }
    const result = await bulk.process.call(testCommon, data.message, data.configuration);
    chai.expect(result.attachments).to.deep.equal(expectedResult);
  });
});
