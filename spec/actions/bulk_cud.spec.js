/* eslint-disable guard-for-in,no-restricted-syntax */
const chai = require('chai');
const nock = require('nock');

const testCommon = require('../common.js');
const testData = require('./bulk_cud.json');
const bulk = require('../../lib/actions/bulk_cud.js');

nock.disableNetConnect();


describe('Salesforce bulk', () => {
  beforeEach(async () => {
    nock(testCommon.refresh_token.url)
      .post('')
      .reply(200, testCommon.refresh_token.response);
  });


  it('action create', async () => {
    const data = testData.bulkInsertCase;
    data.configuration = { ...testCommon.configuration, ...data.configuration };

    const expectedResult = {
      result: [
        { id: '5002o00002E8FIIAA3', success: true, errors: [] },
        { id: '5002o00002E8FIJAA3', success: true, errors: [] },
        { id: '5002o00002E8FIKAA3', success: true, errors: [] },
      ],
    };

    const scopes = [];
    for (const host in data.responses) {
      for (const path in data.responses[host]) {
        scopes.push(nock(host)
          .intercept(path, data.responses[host][path].method)
          .reply(200, data.responses[host][path].response, data.responses[host][path].header));
      }
    }

    const result = await bulk.process.call(testCommon, data.message, data.configuration);

    chai.expect(result.body).to.deep.equal(expectedResult);

    for (let i = 0; i < scopes.length; i += 1) {
      scopes[i].done();
    }
  });


  it('action update', async () => {
    const data = testData.bulkUpdateCase;
    data.configuration = { ...testCommon.configuration, ...data.configuration };

    const expectedResult = { result: [{ id: null, success: false, errors: ['ENTITY_IS_DELETED:entity is deleted:--'] }] };

    const scopes = [];
    for (const host in data.responses) {
      for (const path in data.responses[host]) {
        scopes.push(nock(host)
          .intercept(path, data.responses[host][path].method)
          .reply(200, data.responses[host][path].response, data.responses[host][path].header));
      }
    }

    const result = await bulk.process.call(testCommon, data.message, data.configuration);

    chai.expect(result.body).to.deep.equal(expectedResult);

    for (let i = 0; i < scopes.length; i += 1) {
      scopes[i].done();
    }
  });


  it('action delete', async () => {
    const data = testData.bulkDeleteCase;
    data.configuration = { ...testCommon.configuration, ...data.configuration };

    const expectedResult = { result: [{ id: '5002o00002BT0IUAA1', success: true, errors: [] }] };

    const scopes = [];
    for (const host in data.responses) {
      for (const path in data.responses[host]) {
        scopes.push(nock(host)
          .intercept(path, data.responses[host][path].method)
          .reply(200, data.responses[host][path].response, data.responses[host][path].header));
      }
    }

    const result = await bulk.process.call(testCommon, data.message, data.configuration);

    chai.expect(result.body).to.deep.equal(expectedResult);

    for (let i = 0; i < scopes.length; i += 1) {
      scopes[i].done();
    }
  });
});
