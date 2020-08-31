const { URL } = require('url');
const path = require('path');
const request = require('request-promise');

async function getSecret(emitter, secretId) {
  const parsedUrl = new URL(process.env.ELASTICIO_API_URI);
  parsedUrl.username = process.env.ELASTICIO_API_USERNAME;
  parsedUrl.password = process.env.ELASTICIO_API_KEY;

  parsedUrl.pathname = path.join(
    parsedUrl.pathname || '/',
    'v2/workspaces/',
    process.env.ELASTICIO_WORKSPACE_ID,
    'secrets',
    String(secretId),
  );

  const secretUri = parsedUrl.toString();
  emitter.logger.info('going to fetch secret', secretUri);
  const secret = await request(secretUri);
  const parsedSecret = JSON.parse(secret).data.attributes;
  emitter.logger.info('got secret', parsedSecret);
  return parsedSecret;
}

async function refreshToken(emitter, secretId) {
  const parsedUrl = new URL(process.env.ELASTICIO_API_URI);
  parsedUrl.username = process.env.ELASTICIO_API_USERNAME;
  parsedUrl.password = process.env.ELASTICIO_API_KEY;
  parsedUrl.pathname = path.join(
    parsedUrl.pathname,
    'v2/workspaces/',
    process.env.ELASTICIO_WORKSPACE_ID,
    'secrets',
    secretId,
    'refresh',
  );

  const secretUri = parsedUrl.toString();
  emitter.logger.info('going to refresh secret', secretUri);
  const secret = await request({
    uri: secretUri,
    json: true,
    method: 'POST',
  });
  const token = secret.data.attributes.credentials.access_token;
  emitter.logger.info('got refreshed secret token', token);
  return token;
}

exports.getSecret = getSecret;
exports.refreshToken = refreshToken;
