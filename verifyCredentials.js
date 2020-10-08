const { callJSForceMethod } = require('./lib/helpers/wrapper');

module.exports = async function verify(credentials) {
  try {
    this.logger.trace('Incoming credentials: %j', credentials);
    this.logger.info('Going to make request describeGlobal() for verifying credentials...');
    const result = await callJSForceMethod.call(this, credentials, 'describeGlobal');
    this.logger.info('Credentials are valid, it was found sobjects count: %s', result.sobjects.length);
    return { verified: true };
  } catch (e) {
    this.logger.error(e);
    throw e;
  }
};
