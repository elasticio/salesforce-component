const { expect } = require('chai');
const sinon = require('sinon');
const nock = require('nock');
const logger = require('@elastic.io/component-logger')();
const entry = require('../../lib/entry.js');

const { SalesforceEntity } = entry;
const oAuthUtils = require('../../lib/helpers/oauth-utils');
const httpUtils = require('../../lib/helpers/http-utils');

describe('other Action Unit Test', () => {
  const msg = {};
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

  afterEach(() => {
    sinon.restore();
  });

  it('should emit three events', () => {
    const emitter = {
      emit: sinon.spy(),
      logger,
    };
    const entity = new SalesforceEntity(emitter);
    const res = {
      message: 'some message from example.com',
      statusCode: 201,
    };
    sinon.stub(oAuthUtils, 'refreshAppToken').callsFake((log, component, conf, next) => {
      const refreshedCfg = conf;
      refreshedCfg.oauth.access_token = 'aRefreshedToken';
      next(null, refreshedCfg);
    });
    sinon.stub(httpUtils, 'getJSON').callsFake((log, params, next) => {
      next(null, res);
    });
    nock('https://example.com')
      .post('/services/data/v45.0/sobjects/Contact')
      .reply(res.statusCode, res);

    entity.processAction(configuration.object, msg, configuration);
    expect(emitter.emit.withArgs('updateKeys').callCount).to.equal(1);
    expect(emitter.emit.withArgs('data').callCount).to.equal(1);
    expect(emitter.emit.withArgs('end').callCount).to.equal(1);
    expect(emitter.emit.callCount).to.equal(3);
  });

  it('should emit an error', () => {
    const emitter = {
      emit: sinon.spy(),
      logger,
    };
    const entity = new SalesforceEntity(emitter);
    const error = {
      message: 'some error message from example.com',
      statusCode: 404,
      stack: 'some error stack',
    };
    sinon.stub(oAuthUtils, 'refreshAppToken').callsFake((log, component, conf, next) => {
      next(error);
    });
    entity.processAction.call(emitter, configuration.object, msg, configuration);
    expect(emitter.emit.withArgs('error').callCount).to.equal(1);
    expect(emitter.emit.withArgs('end').callCount).to.equal(1);
    expect(emitter.emit.callCount).to.equal(2);
  });
});
