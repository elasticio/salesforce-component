const chai = require('chai');
const nock = require('nock');
const verify = require('../verifyCredentials');

const { expect } = chai;
const BASE_URL = 'https://someselasforcenode.com';
const path = '/services/data/v32.0/sobjects';
const oauth = {
  access_token: 'some-access-id',
  instance_url: 'https://someselasforcenode.com',
};
let cfg;

describe('Verify Credentials', () => {
  it('should return {verified: false} without credentials in cfg', () => {
    cfg = {};
    verify(cfg, (err, data) => {
      expect(err).to.equal(null);
      expect(data).to.deep.equal({ verified: false });
    });
  });

  it('should return verified false for 401 answer', () => {
    cfg = { oauth };
    nock(BASE_URL, { Authorization: `Bearer ${oauth.access_token}` })
      .get(path)
      .reply(401, '');
    verify(cfg, (err, data) => {
      expect(err).to.equal(null);
      expect(data).to.deep.equal({ verified: false });
    });
  });

  it('should return verified false for 403 answer', () => {
    cfg = { oauth };
    nock(BASE_URL, { Authorization: `Bearer ${oauth.access_token}` })
      .get(path)
      .reply(403, '');
    verify(cfg, (err, data) => {
      expect(err).to.equal(null);
      expect(data.verified).to.equal(false);
    });
  });

  it('should return verified true for 200 answer', () => {
    cfg = { oauth };
    nock(BASE_URL, { Authorization: `Bearer ${oauth.access_token}` })
      .get(path)
      .reply(200, '');
    verify(cfg, (err, data) => {
      expect(err).to.equal(null);
      expect(data).to.deep.equal({ verified: true });
    });
  });

  it('should return error for 500 cases', () => {
    cfg = { oauth };
    nock(BASE_URL, { Authorization: `Bearer ${oauth.access_token}` })
      .get(path)
      .reply(500, 'Super Error');
    verify(cfg, (err) => {
      expect(err.message).to.equal('Salesforce respond with 500');
    });
  });

  it('should throwError', () => {
    cfg = { oauth };
    nock(BASE_URL, { Authorization: `Bearer ${oauth.access_token}` })
      .get(path)
      .replyWithError({
        message: 'something awful happened',
        code: 'AWFUL_ERROR',
      });
    verify(cfg, (err) => {
      expect(err.message).to.equal('something awful happened');
    });
  });
});
