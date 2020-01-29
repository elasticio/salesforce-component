/* eslint-disable no-return-assign */
const chai = require('chai');
const nock = require('nock');

const testCommon = require('../common.js');
const testData = require('./deleteObject.json');
const deleteObject = require('../../lib/actions/deleteObject.js');

nock.disableNetConnect();

describe('Salesforce delete object', () => {
  beforeEach(async () => {
    nock(testCommon.refresh_token.url)
      .post('')
      .reply(200, testCommon.refresh_token.response);
  });

  it('action delete', async () => {
    const data = testData.deleteObject;
    data.configuration = { ...testCommon.configuration, ...data.configuration };

    const expectedResult = { id: '5002o00002E8F3NAAV', success: true, errors: [] };

    const scopes = [];
    for (const host in data.responses) {
      for (const path in data.responses[host]) {
        scopes.push(nock(host)
          .intercept(path, data.responses[host][path].method)
          .reply(200, data.responses[host][path].response, data.responses[host][path].header));
      }
    }
    const response = await deleteObject.process.call(testCommon, data.message, data.configuration);
    chai.expect(response.body.result).to.deep.equal(expectedResult);

    for (let i = 0; i < scopes.length; i++) {
      scopes[i].done();
    }
  });
});
