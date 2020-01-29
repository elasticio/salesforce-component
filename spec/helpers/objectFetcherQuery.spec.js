const nock = require('nock');
const chai = require('chai');
const logger = require('@elastic.io/component-logger')();

const { expect } = chai;
const fetchObjects = require('../../lib/helpers/objectFetcherQuery');

let params = {};
const token = 'token';

describe('Fetching objects', () => {
  beforeEach(() => {
    params = {
      cfg: {
        oauth: {
          access_token: token,
          instance_url: 'https://eu11.salesforce.com',
        },
        apiVersion: 'v25.0',
      },
      query: 'SELECT id, LastName, FirstName FROM Contact',
    };
  });

  describe('should succeed', () => {
    it('should send given query and return result', async () => {
      const expectedResult = [];
      nock('https://eu11.salesforce.com')
        .get('/services/data/v25.0/query?q=SELECT%20id%2C%20LastName%2C%20FirstName%20FROM%20Contact')
        .matchHeader('Authorization', `Bearer ${token}`)
        .reply(200, []);

      const result = await fetchObjects(logger, params);
      expect(result.objects).to.deep.equal(expectedResult);
    });
  });
  describe('should throw an error', () => {
    it('should throw an error if no cfg provided', () => {
      delete params.cfg;

      expect(() => {
        fetchObjects(logger, params);
      }).to.throw('Can\'t fetch objects without a configuration parameter');
    });

    it('should throw an error if no apiVersion provided', () => {
      params.cfg.apiVersion = undefined;

      expect(() => {
        fetchObjects(logger, params);
      }).to.throw('Can\'t fetch objects without an apiVersion');
    });

    it('should throw an error if no object provided', () => {
      delete params.query;

      expect(() => {
        fetchObjects(logger, params);
      }).to.throw('Can\'t fetch objects without a query');
    });
  });
});
