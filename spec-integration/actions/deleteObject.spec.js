/* eslint-disable no-return-assign */
const fs = require('fs');
const sinon = require('sinon');
const { messages } = require('elasticio-node');
const chai = require('chai');
const logger = require('@elastic.io/component-logger')();
const deleteObject = require('../../lib/actions/deleteObject');
const deleteObjectData = require('./deleteObject.json');

const { expect } = chai;

describe('lookupObject', () => {
  let lastCall;
  let configLst;

  beforeEach(async () => {
    lastCall.reset();
  });

  before(async () => {
    // eslint-disable-next-line global-require
    require('dotenv').config({path:__dirname+'/secrets.env'}); 

    lastCall = sinon.stub(messages, 'newMessageWithBody')
      .returns(Promise.resolve());
  });

  after(async () => {
    messages.newMessageWithBody.restore();
  });

  const emitter = {
    emit: sinon.spy(),
    logger,
  };

  it('Correctly throws on a non-existent Contact', async () => {
    await deleteObject.process.call(emitter, message, configuration)
      .then(() => {
        expect(emitter.emit).to.throw;
      });
  });

  it('Correctly deletes an existent Contact', async () => {
    await deleteObject.process.call(emitter, message, configuration)
      .then(() => {
        expect(emitter.emit).to.throw;
      });
  });
});
