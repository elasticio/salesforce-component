const jsforce = require('jsforce');
const common = require('../lib/common.js');

class SalesForceClient {
  constructor(context, configuration) {
    this.logger = context.logger;
    this.connection = new jsforce.Connection({
      // ToDo: Delete 'https://na98.salesforce.com' after implementation https://github.com/elasticio/elasticio/issues/4527
      instanceUrl: configuration.instanceUrl || 'https://na98.salesforce.com',
      accessToken: configuration.access_token,
      version: common.globalConsts.SALESFORCE_API_VERSION,
    });
  }

  async describeGlobal() {
    return this.connection.describeGlobal();
  }
}
module.exports.SalesForceClient = SalesForceClient;
