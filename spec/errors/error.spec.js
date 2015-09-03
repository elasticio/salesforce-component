var createError = require('../../lib/helpers/error.js');

describe('Error creation', function() {

	describe('given an error object with respnseBody and statusCode property', function() {
		it('should return an error object with additional properties: [view: {textKey, defaultText}, statusCode]', function() {

			var input = new Error('Some error message');
			input.responseBody = '{"message":"The REST API is not enabled for this Organization.","errorCode":"API_DISABLED_FOR_ORG"}';
			input.statusCode = 403;

			var error = createError(input);

			expect(error.statusCode).toEqual(403);

			expect(error.view).toEqual({
				textKey : 'salesforce_API_DISABLED_FOR_ORG',
				defaultText : 'The REST API is not enabled for this Organization.'
			});
		});
	});

	describe('given an error object with array in responseBody', function () {
		it('should return an error object prepared for view, from the first member of the array', function () {
			var input = new Error('Some error message');
			input.responseBody = '[{"message":"The REST API is not enabled for this Organization.","errorCode":"API_DISABLED_FOR_ORG"}]';
			input.statusCode = 403;

			var error = createError(input);

			expect(error.statusCode).toEqual(403);

			expect(error.view).toEqual({
				textKey : 'salesforce_API_DISABLED_FOR_ORG',
				defaultText : 'The REST API is not enabled for this Organization.'
			});
		});
	});

	describe('given an error with unparsable responseBody', function () {
		it('should return null', function () {
			var input = new Error('Some error message');

			input.responseBody = "unparsable";

			var error = createError(input);

			expect(error).toBe(null);

		});
	});

});