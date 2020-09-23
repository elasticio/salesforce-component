const { expect } = require('chai');
const nock = require('nock');
const { getSecret, refreshToken } = require('../lib/util');
const testCommon = require('./common.js');

describe('util test', () => {
  afterEach(() => {
    nock.cleanAll();
  });
  it('should getSecret', async () => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}`)
      .reply(200, testCommon.secret);
    const result = await getSecret(testCommon, testCommon.secretId);
    expect(result).to.eql(testCommon.secret.data.attributes);
  });

  it('should refreshToken', async () => {
    nock(process.env.ELASTICIO_API_URI)
      .post(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}/refresh`)
      .reply(200, testCommon.secret);
    const result = await refreshToken(testCommon, testCommon.secretId);
    expect(result).to.eql(testCommon.secret.data.attributes.credentials.access_token);
  });

  it.skip('should refreshToken fail', async () => {
    nock(process.env.ELASTICIO_API_URI)
      .post(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}/refresh`)
      .times(3)
      .reply(500, {})
      .post(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}/refresh`)
      .reply(200, testCommon.secret);
    const result = await refreshToken(testCommon, testCommon.secretId);
    expect(result).to.eql(testCommon.secret.data.attributes.credentials.access_token);
  });
});
