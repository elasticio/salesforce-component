module.exports.globalConsts = {
  SALESFORCE_API_VERSION: process.env.SALESFORCE_API_VERSION || '46.0',
  REFRESH_TOKEN_RETRIES: process.env.REFRESH_TOKEN_RETRIES ? parseInt(process.env.REFRESH_TOKEN_RETRIES, 10) : 10,
};
