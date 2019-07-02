const nock = require('nock');
const chai = require('chai');

const { expect } = chai;
const objectFetcher = require('../../lib/helpers/objectFetcher');

const params = {};

describe('Fetching objects', () => {
  beforeEach(() => {
    params.cfg = {
      oauth: {
        access_token: '00DE0000000dwKc!ARcAQEgJMHustyszwbrh06CGCuYPn2aI..bAV4T8aA8aDXRpAWeveWq7jhUlGl7d2e7T8itqCX1F0f_LeuMDiGzZrdOIIVnE',
        signature: 'BVzAhWIq0NNzW+H0ehXq5ddLAPAX1J5wMmbpqHiURsQ=',
        refresh_token: '5Aep861rEpScxnNE66jGO6gqeJ82V9qXOs5YIxlkVZgWYMSJfjLeqYUwKNfA2R7cU04EyjVKE9_A.vqQY9kjgUg',
        token_type: 'Bearer',
        instance_url: 'https://na9.salesforce.com',
        scope: 'id api refresh_token',
        issued_at: '1396940795887',
        id: 'https://login.salesforce.com/id/00DE0000000dwKcMAI/005E0000002CozkIAC',
      },
      apiVersion: 'v25.0',
      object: 'Contact',
    };
    params.snapshot = '1978-04-06T11:00:00.000Z';
    params.selectFields = 'LastName,FirstName,Salutation,OtherStreet,OtherCity,OtherState,OtherPostalCode,OtherCountry,MailingStreet,MailingCity,MailingState,MailingPostalCode,MailingCountry,Phone,Fax,MobilePhone,HomePhone,OtherPhone,AssistantPhone,Email,Title,Department,AssistantName,LeadSource,Birthdate,Description,EmailBouncedReason,EmailBouncedDate,Jigsaw,Level__c,Languages__c';
  });
  describe('should succeed', () => {
    it('should fetch empty array of specified type with provided query', async () => {
      const expectedResult = [];

      nock('https://na9.salesforce.com')
        .get('/services/data/v25.0/query?q=select%20LastName%2CFirstName%2CSalutation%2COtherStreet%2COtherCity%2COtherState%2COtherPostalCode%2COtherCountry%2CMailingStreet%2CMailingCity%2CMailingState%2CMailingPostalCode%2CMailingCountry%2CPhone%2CFax%2CMobilePhone%2CHomePhone%2COtherPhone%2CAssistantPhone%2CEmail%2CTitle%2CDepartment%2CAssistantName%2CLeadSource%2CBirthdate%2CDescription%2CEmailBouncedReason%2CEmailBouncedDate%2CJigsaw%2CLevel__c%2CLanguages__c%20from%20Contact%20where%20SystemModstamp%20%3E%201978-04-06T11%3A00%3A00.000Z')
        .reply(200, []);

      const result = await objectFetcher(params);
      expect(result.objects).to.deep.equal(expectedResult);
    });

    it('should fetch objects of specified type with provided query', async () => {
      const expectedResult = [{ one: 1 }, { two: 2 }];

      nock('https://na9.salesforce.com')
        .get('/services/data/v25.0/query?q=select%20LastName%2CFirstName%2CSalutation%2COtherStreet%2COtherCity%2COtherState%2COtherPostalCode%2COtherCountry%2CMailingStreet%2CMailingCity%2CMailingState%2CMailingPostalCode%2CMailingCountry%2CPhone%2CFax%2CMobilePhone%2CHomePhone%2COtherPhone%2CAssistantPhone%2CEmail%2CTitle%2CDepartment%2CAssistantName%2CLeadSource%2CBirthdate%2CDescription%2CEmailBouncedReason%2CEmailBouncedDate%2CJigsaw%2CLevel__c%2CLanguages__c%20from%20Contact%20where%20SystemModstamp%20%3E%201978-04-06T11%3A00%3A00.000Z')
        .reply(200, [{ one: 1 }, { two: 2 }]);

      const result = await objectFetcher(params);
      expect(result.objects).to.deep.equal(expectedResult);
    });
  });

  describe('should throw an error', () => {
    it('should throw an error if no snapshot provided', () => {
      params.snapshot = undefined;

      expect(() => { objectFetcher(params); }).to.throw('Can\'t fetch objects without a predefined snapshot');
    });

    it('should throw an error if no cfg provided', () => {
      params.cfg = undefined;

      expect(() => { objectFetcher(params); }).to.throw('Can\'t fetch objects without a configuration parameter');
    });

    it('should throw an error if no apiVersion provided', () => {
      params.cfg.apiVersion = undefined;

      expect(() => { objectFetcher(params); }).to.throw('Can\'t fetch objects without an apiVersion');
    });

    it('should throw an error if no object provided', () => {
      params.cfg.object = undefined;

      expect(() => { objectFetcher(params); }).to.throw('Can\'t fetch objects without an object type');
    });
  });
});
