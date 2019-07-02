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
        signature: '3qwA6Qayx5A+OetPS2VnJjoy8LrlqlyAj2S7Fh7mbEM=',
        scope: 'refresh_token full',
        id_token: 'eyJraWQiOiIyMTgiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdF9oYXNoIjoiU1hUZmZJZllfcDZKZmlNRzlkZjJTZyIsInN1YiI6Imh0dHBzOi8vbG9naW4uc2FsZXNmb3JjZS5jb20vaWQvMDBERTAwMDAwMDBkd0tjTUFJLzAwNTQ0MDAwMDA5MnpxZEFBQSIsImF1ZCI6IjNNVkc5eTZ4MDM1N0hsZWZiWFhrQmZySjJ0eklnNS43TElRZFJEbHhLWEFZYTllNHJGbUUzMVJNMmdsZmpjYlJ5V2w3TDR6dnpHWGZBSDhtSTlvUDkiLCJpc3MiOiJodHRwczovL2xvZ2luLnNhbGVzZm9yY2UuY29tIiwiZXhwIjoxNTUzNjk3OTQwLCJpYXQiOjE1NTM2OTc4MjB9.AC3FjjXtVd3cuuR3NmDoY7iAphqkN-vV2O-IRMY0JOmJ2l7Nd3Bkuq0KyD_LrPS_t7OQr6qIWuzmw_uopSgrp8EsEyXGoz6tb_bao5P7tOfBiTRkydEn_qUmnu_52EW-yXHbpLPiKjJ2cuKOx1c9L99AJD7Z6UU1t2X7SDJGokmmFl9Lr0PcOqPu2OdiDnDErvzevzZLyke2liS5U0X9uxD9F0H1v78rjF4GlZa5rWLoJPvLD89SMMnQXbJxPOIlTOTqg5yQH-iCz300_oafwC0Xr7nbXOP0oDn1erESTDiMzVjYiV0jEFRkOZROVK2nyRPxdXjEo8rFHLxImkw9fP_9x0TfV143_k3uCyELE4Mem9iixpg1cnIBv9axur_dhSBrLFUbhKfgL3pJYow-mo1_i0B8-SrRD02-W0OfgL7spWBlO78wWIJDruJuifL3FFj206nQLncXb1YMPfO9_62-zN23dHDgDB1QXAE-edQOn3mUKQ-Z-sFvqYdQKIsdWz0HNf1r_r0dqo2y8szxYUNEEae_q0BXlxTjXw5qNpd5BFSimrC5tQeoNoa7d1Sn8tMJugSKW6N8NXLYcDkXv8FM7APy3fyojOXlsX2ll-LC7fMs-LfYuDonvg13KnwEI4QR8ycmMpqJdgGD2tL9Tm20KejQwvv8YvX2zK6GDsw',
        instance_url: 'https://na38.salesforce.com',
        id: 'https://login.salesforce.com/id/00DE0000000dwKcMAI/005440000092zqdAAA',
        token_type: 'Bearer',
        issued_at: '1554112253506',
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
