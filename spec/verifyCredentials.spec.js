const chaiAsPromised = require('chai-as-promised');
const chai = require('chai');

chai.use(chaiAsPromised);
const { expect } = chai;

const nock = require('nock');
const logger = require('@elastic.io/component-logger')();

const common = require('../lib/common.js');
const testCommon = require('./common');
const verify = require('../verifyCredentials');

let cfg;
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

describe('Verify Credentials', () => {
  it('should return verified true for 200 answer', async () => {
    cfg = {
      oauth: {
        access_token: 'accessToken',
        instance_url: testCommon.instanceUrl,
      },
    };
    nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects`)
      .reply(200, { done: true, totalSize: testReply.result.length, sobjects: testReply.result });
    const result = await verify.call({ logger }, cfg);
    expect(result).to.deep.equal({ verified: true });
  });

  it('should throwError', async () => {
    cfg = {
      oauth: {
        access_token: 'accessToken',
        instance_url: testCommon.instanceUrl,
      },
    };
    nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects`)
      .reply(500);
    await expect(verify.call({ logger }, cfg)).be.rejected;
  });
});
