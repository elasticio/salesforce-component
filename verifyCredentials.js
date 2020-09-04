const sfConnection = require('./lib/helpers/sfConnection.js');

module.exports = async function verify(credentials) {
  try {
    this.logger.info('Incomming credentials: %j', credentials);
    const connection = await sfConnection.createConnection(credentials.oauth.access_token, this);
    this.logger.info('Connection is created, trying to describeGlobal...');
    const result = await connection.describeGlobal();
    this.logger.info('Credentials are valid, sobjects count: %s', result.sobjects.length);
    return { verified: true };
  } catch (e) {
    this.logger.error(e);
    throw e;
  }
};
