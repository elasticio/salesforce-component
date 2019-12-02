const nock = require('nock');
const sinon = require('sinon');
const chai = require('chai');
const entry = require('../lib/entry.js');
const objectDescription = require('./testData/objectDescriptionForMetadata');
const expectedMetadataOut = require('./testData/expectedMetadataOut');
const objectsList = require('./testData/objectsList');
const oAuthUtils = require('../lib/helpers/oauth-utils.js');
const common = require("../lib/common.js");

const { expect } = chai;
let emitter;

describe('Test entry', () => {
  beforeEach(() => {
    emitter = {
      emit: sinon.spy(),
    };
    sinon.stub(entry, 'SalesforceEntity').callsFake(() => new entry.SalesforceEntity(emitter));
    sinon.stub(oAuthUtils, 'refreshAppToken').callsFake((component, conf, next) => {
      const refreshedCfg = conf;
      refreshedCfg.oauth.access_token = 'aRefreshedToken';
      next(null, refreshedCfg);
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Test getMetaModel', () => {
    it('Get Out Metadata, other entity type', (done) => {
      nock('http://localhost:1234')
        .matchHeader('Authorization', 'Bearer aRefreshedToken')
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Event/describe`)
        .reply(200, JSON.stringify(objectDescription));

      const cfg = {
        sobject: 'Event',
        oauth: {
          instance_url: 'http://localhost:1234',
          access_token: 'aToken',
        },
      };
      entry.getMetaModel.call(emitter, cfg, (error, result) => {
        if (error) return done(error);
        try {
          expect(error).to.equal(null);
          expect(result).to.deep.equal({ out: expectedMetadataOut });
          expect(emitter.emit.withArgs('updateKeys').callCount).to.be.equal(1);
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });
  });

  describe('Test objectTypes', () => {
    it('should return object types', (done) => {
      nock('http://localhost:1234')
        .matchHeader('Authorization', 'Bearer aRefreshedToken')
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects`)
        .reply(200, JSON.stringify(objectsList));

      const cfg = {
        object: 'Event',
        oauth: {
          instance_url: 'http://localhost:1234',
          access_token: 'aToken',
        },
      };
      entry.objectTypes.call(emitter, cfg, (error, result) => {
        if (error) return done(error);
        try {
          expect(error).to.equal(null);
          expect(result).to.deep.equal({ Account: 'Account', AccountContactRole: 'Account Contact Role' });
          expect(emitter.emit.withArgs('updateKeys').callCount).to.be.equal(1);
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });
  });
});
