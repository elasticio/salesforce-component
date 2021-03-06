const sinon = require('sinon');
const { expect } = require('chai');
const logger = require('@elastic.io/component-logger')();
const helper = require('../../lib/helpers/oauth-utils');
const httpUtils = require('../../lib/helpers/http-utils');

describe('oauth-utils Unit Test', () => {
  const configuration = {
    apiVersion: '39.0',
    oauth: {
      issued_at: '1541510572760',
      token_type: 'Bearer',
      id: 'https://login.salesforce.com/id/11/11',
      instance_url: 'https://example.com',
      id_token: 'ddd',
      scope: 'refresh_token full',
      signature: '=',
      refresh_token: 'refresh_token',
      access_token: 'access_token',
    },
    object: 'Contact',
  };
  const serviceURI = 'https://serviceuri.com/testing';
  const clientIdKey = 'clientIdKey';
  const clientSecretKey = 'clientSecretKey';

  afterEach(() => {
    sinon.restore();
  });

  it('should return a new configuration object', async () => {
    const refreshResponse = {
      access_token: 'newAccessToken',
      refresh_token: 'newRefreshToken',
    };
    sinon.stub(httpUtils, 'getJSON').callsFake((log, params, next) => {
      next(null, refreshResponse);
    });

    helper.refreshToken(logger, serviceURI, clientIdKey, clientSecretKey, configuration,
      (error, newConf) => {
        expect(newConf.oauth.access_token).to.equal('newAccessToken');
        expect(newConf.oauth.refresh_token).to.equal('newRefreshToken');
      });
  });

  it('should throw an error', () => {
    const error = {
      message: 'some error thrown',
      statusCode: 404,
    };
    sinon.stub(httpUtils, 'getJSON').callsFake((log, params, next) => {
      next(error);
    });

    // eslint-disable-next-line max-len
    helper.refreshToken(logger, serviceURI, clientIdKey, clientSecretKey, configuration, (err) => {
      expect(err.message).to.equal('some error thrown');
      expect(err.statusCode).to.equal(404);
    });
  });
});
