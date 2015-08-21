function createPresentableError(err) {
	const SALESFORCE_ERROR_KEY_PREFIX = 'salesforce_';
	const SALESFORCE_UNKNOWN_ERROR_KEY = SALESFORCE_ERROR_KEY_PREFIX + 'UNKNOWN';
	var view = {};

	if(typeof err.responseBody !== 'string') return null;

	var errorBody;
	try {
		errorBody = JSON.parse(err.responseBody);

		if(errorBody.length) {
			errorBody = errorBody[0];
		}

	} catch (parseError) {

		console.log(parseError);
		return null;
	}
	
	view.defaultText = errorBody.message || 'An error occured. Please try later';
	view.textKey = errorBody.errorCode ? SALESFORCE_ERROR_KEY_PREFIX + errorBody.errorCode : SALESFORCE_UNKNOWN_ERROR_KEY;

	err.view = view;

	return err;
}


module.exports = createPresentableError;