/* eslint-disable no-return-assign */
const chai = require('chai');
const nock = require('nock');

const testCommon = require('../common.js');
const testData = require('./bulk_q.json');
const bulk = require('../../lib/actions/bulk_q.js');

nock.disableNetConnect();


describe('Salesforce bulk query', () => {
  beforeEach(async () => {
    nock(testCommon.refresh_token.url)
      .post('')
      .reply(200, testCommon.refresh_token.response);
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
