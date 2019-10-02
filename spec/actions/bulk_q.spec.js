/* eslint-disable no-return-assign */
const chai = require('chai');
const nock = require('nock');
const sinon = require('sinon');

const testCommon = require('../common.js');
const testData = require('./bulk_q.json');

nock.disableNetConnect();


describe('Salesforce bulk query', () => {
  beforeEach(async () => {
    nock(testCommon.refresh_token.url)
      .post('')
      .reply(200, testCommon.refresh_token.response);
  });


  it('action query', async () => {
    console.log('action query');

    const data = testData.bulkQuery;
    data.configuration = { ...testCommon.configuration, ...data.configuration };

    const expectedResult = { "bulk_query.csv": { "content-type": "text/csv", "url": "http://file.storage.server/file" } };

    for (let host in data.responses) {
      for (let path in data.responses[host]) {
        nock(host).
          intercept(path, data.responses[host][path].method).
          reply(200, data.responses[host][path].response, data.responses[host][path].header);
      }
    }

    require('elasticio-rest-node');

    require.cache[require.resolve('elasticio-rest-node')] = {
      exports: sinon.stub().callsFake(() => {
        return {
          resources: {
            storage: {
              createSignedUrl: () => {
                return {
                  "get_url": "http://file.storage.server/file",
                  "put_url": "http://file.storage.server/file"
                }
              }
            }
          }
        };
      })
    };

    const bulk = require('../../lib/actions/bulk_q.js');

    const result = await bulk.process(data.message, data.configuration);

    chai.expect(result.attachments).to.deep.equal(expectedResult);
  });

});