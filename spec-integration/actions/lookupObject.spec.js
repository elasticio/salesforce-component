/* eslint-disable no-return-assign */
const fs = require('fs');
const sinon = require('sinon');
const { messages } = require('elasticio-node');
const chai = require('chai');
const lookupObject = require('../../lib/actions/lookupObject');

const { expect } = chai;

describe('lookupObject', () => {
  let message;
  let lastCall;
  let configuration;

  beforeEach(async () => {
    lastCall.reset();
  });

  before(async () => {
    if (fs.existsSync('.env')) {
      // eslint-disable-next-line global-require
      require('dotenv').config();
    }

    lastCall = sinon.stub(messages, 'newMessageWithBody')
      .returns(Promise.resolve());

    configuration = {
      apiVersion: '45.0',
      oauth: {
        instance_url: 'https://na38.salesforce.com',
        refresh_token: process.env.REFRESH_TOKEN,
        access_token: process.env.ACCESS_TOKEN,
      },
      prodEnv: 'login',
      sobject: 'Contact',
      _account: '5be195b7c99b61001068e1d0',
      lookupField: 'Id',
      typeOfSearch: 'uniqueFields',
    };
    message = {
      body: {
        Id: '0032R000025bpDYQAY',
      },
    };
  });

  after(async () => {
    messages.newMessageWithBody.restore();
  });

  const emitter = {
    emit: sinon.spy(),
  };

  it('lookupObject Contacts ', async () => {
    await lookupObject.process.call(emitter, message, configuration)
      .then(() => {
        expect(lastCall.lastCall.args[0].attributes.type).to.eql('Contact');
      });
  });

  it('Contact Lookup fields ', async () => {
    await lookupObject.getLookupFieldsModel(configuration)
      .then((result) => {
        expect(result).to.be.deep.eql({
          Demo_Email__c: 'Demo Email (Demo_Email__c)',
          Id: 'Contact ID (Id)',
          extID__c: 'extID (extID__c)',
        });
      });
  });
  it('Contact objectTypes ', async () => {
    await lookupObject.objectTypes(configuration)
      .then((result) => {
        expect(result.Account).to.be.eql('Account');
      });
  });

  it('Contact Lookup Meta', async () => {
    await lookupObject.getMetaModel(configuration)
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
