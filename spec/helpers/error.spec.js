const chai = require('chai');

const { expect } = chai;
const createPresentableError = require('../../lib/helpers/error.js');

describe('Error creation', () => {
  describe('given an error object with respnseBody and statusCode property', () => {
    it('should return an error object with additional properties: [view: {textKey, defaultText}, statusCode]', () => {
      const input = new Error('Some error message');
      input.responseBody = '{"message":"The REST API is not enabled for this Organization.","errorCode":"API_DISABLED_FOR_ORG"}';
      input.statusCode = 403;

      const error = createPresentableError(input);

      expect(error.statusCode).to.equal(403);
      expect(error.view).to.deep.equal({
        textKey: 'salesforce_API_DISABLED_FOR_ORG',
        defaultText: 'The REST API is not enabled for this Organization.',
      });
    });
  });

  describe('given an error object with array in responseBody', () => {
    it('should return an error object prepared for view, from the first member of the array', () => {
      const input = new Error('Some error message');
      input.responseBody = '[{"message":"The REST API is not enabled for this Organization.","errorCode":"API_DISABLED_FOR_ORG"}]';
      input.statusCode = 403;

      const error = createPresentableError(input);

      expect(error.statusCode).to.equal(403);
      expect(error.view).to.deep.equal({
        textKey: 'salesforce_API_DISABLED_FOR_ORG',
        defaultText: 'The REST API is not enabled for this Organization.',
      });
    });
  });

  describe('given an error with unparsable responseBody', () => {
    it('should return null', () => {
      const input = new Error('Some error message');
      input.responseBody = {};
      const error = createPresentableError(input);

      expect(error).to.equal(null);
    });
  });
});
