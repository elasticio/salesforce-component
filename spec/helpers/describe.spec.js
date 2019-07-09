const nock = require('nock');
const chai = require('chai');

const { expect } = chai;
const { describeObject, fetchObjectTypes } = require('../../lib/helpers/describe');
const description = require('../testData/objectDescription.json');
const objectLists = require('../testData/objectsList.json');

const cfg = {
  oauth: {
    access_token: '00DE0000000dwKc!ARcAQEgJMHustyszwbrh06CGCuYPn2aI..bAV4T8aA8aDXRpAWeveWq7jhUlGl7d2e7T8itqCX1F0f_LeuMDiGzZrdOIIVnE',
    refresh_token: '5Aep861rEpScxnNE66jGO6gqeJ82V9qXOs5YIxlkVZgWYMSJfjLeqYUwKNfA2R7cU04EyjVKE9_A.vqQY9kjgUg',
    instance_url: 'https://na9.salesforce.com',
  },
  object: 'Contact',
  apiVersion: 'v25.0',
};

describe('Describe helper', () => {
  it('describeObject should fetch a description for the specified object type', async () => {
    nock('https://na9.salesforce.com')
      .get('/services/data/v25.0/sobjects/Contact/describe')
      .reply(200, JSON.stringify(description));

    const result = await describeObject({ cfg });
    expect(result).to.deep.equal(description);
  });

  it('should fetch a description for the specified object type', (done) => {
    nock('https://na9.salesforce.com')
      .get('/services/data/v25.0/sobjects')
      .reply(200, objectLists);

    fetchObjectTypes(cfg, (err, result) => {
      try {
        expect(err).to.equal(null);
        expect(result).to.deep.equal({
          Account: 'Account',
          AccountContactRole: 'Account Contact Role',
        });
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});
