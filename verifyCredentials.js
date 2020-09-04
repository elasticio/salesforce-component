const { callJSForceMethod } = require('./lib/helpers/wrapper');

module.exports = async function verify(credentials) {
  try {
    this.logger.info('Incoming credentials: %j', credentials);
    const result = await callJSForceMethod.call(this, credentials, 'describeGlobal');
    this.logger.info('Credentials are valid, sobjects count: %s', result.sobjects.length);
    return { verified: true };
  } catch (e) {
    this.logger.error(e);
    throw e;
  }
};
