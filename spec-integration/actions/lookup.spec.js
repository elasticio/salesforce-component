/* eslint-disable no-return-assign */
const fs = require('fs');
const sinon = require('sinon');
const { messages } = require('elasticio-node');
const chai = require('chai');
const logger = require('@elastic.io/component-logger')();
const lookup = require('../../lib/actions/lookup');

const { expect } = chai;

describe('lookup', () => {
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
      apiVersion: '39.0',
      oauth: {
        instance_url: 'https://na38.salesforce.com',
        refresh_token: process.env.REFRESH_TOKEN,
        access_token: process.env.ACCESS_TOKEN,
      },
      prodEnv: 'login',
      sobject: 'Contact',
      _account: '5be195b7c99b61001068e1d0',
      lookupField: 'AccountId',
      batchSize: 2,
    };
    message = {
      body: {
        AccountId: '0014400001ytQUJAA2',
      },
    };
  });

  after(async () => {
    messages.newMessageWithBody.restore();
  });

  const emitter = {
    emit: sinon.spy(),
    logger,
  };

  it('lookup Contacts ', async () => {
    await lookup.process.call(emitter, message, configuration)
      .then(() => {
        expect(lastCall.lastCall.args[0].result[0].attributes.type).to.eql('Contact');
      });
  });

  it('Contact Lookup fields ', async () => {
    await lookup.getLookupFieldsModel(configuration)
      .then((result) => {
        expect(result).to.be.deep.eql({
          Id: 'Contact ID',
          IndividualId: 'Individual ID',
          MasterRecordId: 'Master Record ID',
          AccountId: 'Account ID',
          ReportsToId: 'Reports To ID',
          OwnerId: 'Owner ID',
          CreatedById: 'Created By ID',
          Demo_Email__c: 'Demo Email',
          LastModifiedById: 'Last Modified By ID',
          extID__c: 'extID',
        });
      });
  });
  it('Contact objectTypes ', async () => {
    await lookup.objectTypes.call(emitter, configuration)
      .then((result) => {
        expect(result.Account).to.be.eql('Account');
      });
  });

  it('Contact Lookup Meta', async () => {
    await lookup.getMetaModel.call(emitter, configuration)
      .then((result) => {
        expect(result.in).to.be.deep.eql({
          type: 'object',
          properties: {
            AccountId: {
              type: 'string', required: false, title: 'Account ID', default: null,
            },
          },
        });
        expect(result.out.properties.Id).to.be.deep.eql(
          {
            type: 'string', required: false, title: 'Contact ID', default: null,
          },
        );
      });
  });
});
