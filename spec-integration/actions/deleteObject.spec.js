/* eslint-disable no-return-assign */
const fs = require('fs');
const sinon = require('sinon');
const { messages } = require('elasticio-node');
const chai = require('chai');
const logger = require('@elastic.io/component-logger')();
const deleteObject = require('../../lib/actions/deleteObject');
const { refreshAppToken } = require('../../lib/helpers/oauth-utils');
const jsforce = require('jsforce');
const httpUtils = require('../../lib/helpers/http-utils.js');

const { expect } = chai;

describe('deleteObject', () => {
  let message;
  let lastCall;
  let configuration;

  beforeEach(async () => {
    lastCall.reset();
  });

  before(async () => {
    // eslint-disable-next-line global-require
    require('dotenv').config({path:__dirname+'/secrets.env'});

    lastCall = sinon.stub(messages, 'newMessageWithBody')
      .returns(Promise.resolve());

    var conn = new jsforce.Connection({ oauth2 : 
        
        new jsforce.OAuth2({
        // you can change loginUrl to connect to sandbox or prerelease env.
        loginUrl : 'https://login.salesforce.com',
        clientId : 'process.env.OAUTH_CLIENT_ID',
        clientSecret : 'process.env.OAUTH_CLIENT_SECRET',
        redirectUri : 'https://login.salesforce.com/services/oauth2/success'
        })

    });

    await conn.authorize(code, function(err, userInfo) {
        if (err) { return console.error(err); }
        // Now you can get the access token, refresh token, and instance URL information.
        // Save them to establish connection next time.
        console.log(conn.accessToken);
        console.log(conn.refreshToken);
        console.log(conn.instanceUrl);
        console.log("User ID: " + userInfo.id);
        console.log("Org ID: " + userInfo.organizationId);
        // ...
    });    

//     configuration = {
//       apiVersion: '45.0',
//       oauth: {
//         instance_url: 'https://na38.salesforce.com',
//         access_token: process.env.ACCESS_TOKEN,
//       },
//       prodEnv: 'login',
//       sobject: 'Contact',
//       _account: '5be195b7c99b61001068e1d0',
//       lookupField: 'Id',
//       typeOfSearch: 'uniqueFields',
//     };
//     message = {
//       body: {
//         Id: '0032R000027DryfQAC',
//       },
//     };
//   });
  });

  after(async () => {
    messages.newMessageWithBody.restore();
  });

  const emitter = {
    emit: sinon.spy(),
    logger,
  };

  it('delete Object Contact ', async () => {
    await deleteObject.process.call(emitter, message, configuration)
      .then(() => {
        expect(lastCall.lastCall.args[0].attributes.type).to.eql('Contact');
      });
  });

  it('Contact Lookup fields ', async () => {
    await deleteObject.getLookupFieldsModel(configuration)
      .then((result) => {
        expect(result).to.be.deep.eql({
          Demo_Email__c: 'Demo Email (Demo_Email__c)',
          Id: 'Contact ID (Id)',
          extID__c: 'extID (extID__c)',
        });
      });
  });
  it('Contact objectTypes ', async () => {
    await deleteObject.objectTypes.call(emitter, configuration)
      .then((result) => {
        expect(result.Account).to.be.eql('Account');
      });
  });

  it('Contact Lookup Meta', async () => {
    await deleteObject.getMetaModel.call(emitter, configuration)
      .then((result) => {
        expect(result.in).to.be.deep.eql({
          type: 'object',
          properties: {
            Id: {
              type: 'string',
              required: true,
              title: 'Contact ID',
              default: null,
            },
          },
        });
      });
  });
});
