/* eslint-disable no-return-assign */
const fs = require('fs');
const sinon = require('sinon');
const { messages } = require('elasticio-node');
const chai = require('chai');
const logger = require('@elastic.io/component-logger')();
const upsert = require('../../lib/actions/upsert');

const { expect } = chai;

describe('upsert', () => {
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
    };
    message = {
      body: {
        Id: '00344000020qT3KAAU',
        MobilePhone: '+3805077777',
        extID__c: '777777777777',
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

  it('upsert Contact by Id ', async () => {
    await upsert.process.call(emitter, message, configuration).then(() => {
      expect(lastCall.lastCall.args[0].MobilePhone)
        .to
        .eql(message.body.MobilePhone);
    });
  });

  it('upsert Contact by ExternalId ', async () => {
    message = {
      body: {
        MobilePhone: '+38050888888',
        extID__c: '777777777777',
      },
    };
    configuration.extIdField = 'extID__c';
    await upsert.process.call(emitter, message, configuration).then(() => {
      expect(lastCall.lastCall.args[0].MobilePhone)
        .to
        .eql(message.body.MobilePhone);
    });
  });
});
