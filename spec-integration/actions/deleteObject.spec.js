/* eslint-disable no-return-assign */
const fs = require('fs');
const sinon = require('sinon');
const { messages } = require('elasticio-node');
const chai = require('chai');
const logger = require('@elastic.io/component-logger')();
const deleteObject = require('../../lib/actions/deleteObject');
const deleteObjectData = require('./deleteObject.json');

const { expect } = chai;

describe('lookupObject Integration Functionality', () => {
  let lastCall;

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
    const config = deleteObjectData.cases[0].config;
    config.oauth.refresh_token = process.env.REFRESH_TOKEN;
    config.oauth.access_token = process.env.ACCESS_TOKEN;
    await deleteObject.process.call(emitter, deleteObjectData.cases[0].message, config)
      .then(() => {
        expect(emitter.emit.args[1][1]).to.be.instanceOf(Error);
      });
  });

  it('Correctly deletes an existent Contact', async () => {
    const config = deleteObjectData.cases[1].config;
    config.oauth.refresh_token = process.env.REFRESH_TOKEN;
    config.oauth.access_token = process.env.ACCESS_TOKEN;
    await deleteObject.process.call(emitter, deleteObjectData.cases[1].message, deleteObjectData.cases[1].config)
      .then(() => {
        expect(emitter.emit.args[1][1]).to.be.deep.equal(deleteObjectData.cases[1].response);
      });
  });

  // if a parent_object is deleted so is the child in salesforce
  it('Correctly deletes a custom Table with a relationship master-detail relationship', async () => {
    const config = deleteObjectData.cases[2].config;
    config.oauth.refresh_token = process.env.REFRESH_TOKEN;
    config.oauth.access_token = process.env.ACCESS_TOKEN;
    await deleteObject.process.call(emitter, deleteObjectData.cases[2].message, deleteObjectData.cases[2].config)
      .then(() => {
        expect(emitter.emit.args[1][1]).to.be.deep.equal(deleteObjectData.cases[2].response);
      });
  });

  // if the parent object is mandatory in a lookup then this should fail
  it('Correctly throws a custom Table with a lookup relationship thats required', async () => {
    const config = deleteObjectData.cases[3].config;
    config.oauth.refresh_token = process.env.REFRESH_TOKEN;
    config.oauth.access_token = process.env.ACCESS_TOKEN;
    await deleteObject.process.call(emitter, deleteObjectData.cases[3].message, deleteObjectData.cases[3].config)
      .then(() => {
        expect(emitter.emit.args[1][1]).to.be.instanceOf(Error);
      });
  });

  it('Correctly identifies when more than one object is found and throws', async () => {
    const config = deleteObjectData.cases[4].config;
    config.oauth.refresh_token = process.env.REFRESH_TOKEN;
    config.oauth.access_token = process.env.ACCESS_TOKEN;
    await deleteObject.process.call(emitter, deleteObjectData.cases[4].message, deleteObjectData.cases[4].config)
      .then(() => {
        expect(emitter.emit.args[1][1]).to.be.instanceOf(Error);
      });
  });

  it('Correctly deletes based on different criteria: allFields ( Date/Time )', async () => {
    const config = deleteObjectData.cases[5].config;
    config.oauth.refresh_token = process.env.REFRESH_TOKEN;
    config.oauth.access_token = process.env.ACCESS_TOKEN;
    await deleteObject.process.call(emitter, deleteObjectData.cases[5].message, deleteObjectData.cases[5].config)
      .then(() => {
        expect(emitter.emit.args[1][1]).to.be.deep.equal(deleteObjectData.cases[5].response);
      });
  });

  it('Correctly deletes based on different criteria: uniqueField ( Lookup )', async () => {
    const config = deleteObjectData.cases[6].config;
    config.oauth.refresh_token = process.env.REFRESH_TOKEN;
    config.oauth.access_token = process.env.ACCESS_TOKEN;
    await deleteObject.process.call(emitter, deleteObjectData.cases[6].message, deleteObjectData.cases[6].config)
      .then(() => {
        expect(emitter.emit.args[1][1]).to.be.deep.equal(deleteObjectData.cases[6].response);
      });
  });
  
});
