/**
 * Common functionality for OAuth
 * */
const util = require('util');
const { handlebars } = require('hbs');
const _ = require('lodash');
const httpUtils = require('./http-utils.js');

/**
 * This function refreshes OAuth token.
 *
 * @param logger
 * @param serviceUri
 * @param clientIdKey
 * @param clientSecretKey
 * @param conf
 * @param next
 */
function refreshToken(logger, serviceUri, clientIdKey, clientSecretKey, conf, next) {
  // const clientId = getValueFromEnv(clientIdKey);
  // const clientSecret = getValueFromEnv(clientSecretKey);
  const clientId = '3MVG9y6x0357HlefbXXkBfrJ2txm9m6Sb5NZlVBFmNfzNQWy6raJ0_nKanW4SgaOj7EJMII_HLPs9mbB0JxE5';
  const clientSecret = '8606525913706843933';


  // Now we need to resolve URI in case we have a replacement groups inside it
  // for example for Salesforce we have a production and test environemnt
  // or shopware the user domain is part of OAuth URIs
  const refreshURI = resolveVars(serviceUri, conf);

  const params = {
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: conf.oauth ? conf.oauth.refresh_token : null,
    format: 'json',
  };

  const newConf = _.cloneDeep(conf);

  httpUtils.getJSON(logger, {
    url: refreshURI,
    method: 'post',
    form: params,
  }, (err, refreshResponse) => {
    if (err) {
      logger.error('Failed to refresh token from %s', serviceUri);
      return next(err);
    }
    logger.info('Refreshed token from %s', serviceUri);
    // update access token in configuration
    newConf.oauth.access_token = refreshResponse.access_token;
    // if new refresh_token returned, update that also
    // specification is here http://tools.ietf.org/html/rfc6749#page-47
    if (refreshResponse.refresh_token) {
      newConf.oauth.refresh_token = refreshResponse.refresh_token;
    }
    next(null, newConf);
  });
}

function getValueFromEnv(key) {
  const compiled = handlebars.compile(key);
  const value = compiled(process.env);
  if (value) {
    return value;
  }
  throw new Error(util.format("No value is defined for environment variable: '%s'", key));
}

function refreshAppToken(logger, app, conf, cb) {
  const appDef = require('../../component.json');
  const credentials = appDef.credentials || {};
  const { oauth2 } = credentials;

  refreshToken(
    logger,
    oauth2.token_uri,
    oauth2.client_id,
    oauth2.client_secret,
    conf,
    cb,
  );
}

/**
 * This function resolves the variables in the string using hanlebars
 *
 * @param template
 * @param context
 * @returns {*}
 */
function resolveVars(template, context) {
  const compiled = handlebars.compile(template);
  return compiled(context);
}

exports.refreshToken = refreshToken;
exports.refreshAppToken = refreshAppToken;
