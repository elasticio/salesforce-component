function createPresentableError(err) {
    const ERROR_KEY_PREFIX = 'salesforce_';
    const UNKNOWN_ERROR_KEY = ERROR_KEY_PREFIX + 'UNKNOWN';
    var errorBody;

    if (typeof err.responseBody !== 'string') {
        return null;
    }

    try {
        errorBody = JSON.parse(err.responseBody);
        if (errorBody.length) {
            errorBody = errorBody[0];
        }
    } catch (parseError) {
        console.log(parseError);
        return null;
    }

    var view = {};
    view.defaultText = errorBody.message || 'An error occured. Please try later';
    view.textKey = errorBody.errorCode ? ERROR_KEY_PREFIX + errorBody.errorCode : UNKNOWN_ERROR_KEY;
    err.view = view;
    return err;
}

module.exports = createPresentableError;