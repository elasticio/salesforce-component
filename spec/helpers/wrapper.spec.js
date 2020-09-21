const { expect } = require('chai');
const nock = require('nock');
const logger = require('@elastic.io/component-logger')();
const common = require('../../lib/common.js');
const testCommon = require('../common.js');
const { callJSForceMethod } = require('../../lib/helpers/wrapper');

describe('wrapper helper', () => {
  afterEach(() => {
    nock.cleanAll();
  });
  it('should succeed call describe method', async () => {
    const cfg = {
      secretId: testCommon.secretId,
      sobject: 'Contact',
    };
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}`)
      .reply(200, testCommon.secret);
    nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Contact/describe`)
      .reply(200, { name: 'Contact' });
    const result = await callJSForceMethod.call({ logger }, cfg, 'describe');
    expect(result.name).to.eql('Contact');
  });

  it('should succeed call describe method, credentials from config', async () => {
    const cfg = {
      sobject: 'Contact',
      oauth: {
        access_token: 'access_token',
        undefined_params: {
          instance_url: testCommon.instanceUrl,
        },
      },
    };
    nock(testCommon.instanceUrl, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Contact/describe`)
      .reply(200, { name: 'Contact' });
    const result = await callJSForceMethod.call({ logger }, cfg, 'describe');
    expect(result.name).to.eql('Contact');
  });

  it('should refresh token and succeed call describe method', async () => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}`)
      .reply(200, {
        data: {
          attributes: {
            credentials: {
              access_token: 'oldAccessToken',
              undefined_params: {
                instance_url: testCommon.instanceUrl,
              },
            },
          },
        },
      })
      .post(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}/refresh`)
      .reply(200, testCommon.secret);
    const cfg = {
      secretId: testCommon.secretId,
      sobject: 'Contact',
    };
    nock(testCommon.instanceUrl, { reqheaders: { authorization: 'Bearer oldAccessToken' } })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Contact/describe`)
      .replyWithError({ name: 'INVALID_SESSION_ID' });
    nock(testCommon.instanceUrl, { reqheaders: { authorization: 'Bearer accessToken' } })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Contact/describe`)
      .reply(200, { name: 'Contact' });
    const result = await callJSForceMethod.call({ logger }, cfg, 'describe');
    expect(result.name).to.eql('Contact');
  });
});
