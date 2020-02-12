/* eslint-disable no-return-assign */
const sinon = require('sinon');
const chai = require('chai');
const logger = require('@elastic.io/component-logger')();
const deleteObject = require('../../lib/actions/deleteObject');
const { testDataFactory } = require('../../lib/helpers/deleteObjectHelpers');

const { expect } = chai;

describe('Delete Object Integration Functionality', () => {

  var emitter;
  let testObj;
  let testObjGen;
  before(async () => {
    // eslint-disable-next-line global-require
    require('dotenv').config({path:__dirname+'/secrets.env'}); 

    emitter = {
      emit: sinon.spy(),
      logger,
    };

    testObjGen = testDataFactory.call(emitter);
  });

  beforeEach(() => {
    emitter.emit.resetHistory();
  })

  it('Correctly identifies a lack of response on a non-existent Contact', async () => {
    testObj = await testObjGen.next() 
    if (!( testObj.value )) {
      throw Error('Test data was not sucessfully created');
    }
    await deleteObject.process.call(emitter, testObj.message, testObj.config)
    expect(emitter.emit.args[2][1].body).to.be.empty;
  });

  it('Correctly deletes an existent Contact', async () => {
    testObj = await testObjGen.next() 
    if (!( testObj.value )) {
      throw Error('Test data was not sucessfully created');
    }
    await deleteObject.process.call(emitter, testObj.message, testObj.config)
    expect(emitter.emit.args[2][1].body).to.be.deep.equal(testObj.response);
  });

  it('Correctly identifies when more than one object is found and throws', async () => {
    testObj = await testObjGen.next() 
    if (!( testObj.value )) {
      throw Error('Test data was not sucessfully created');
    }
    await deleteObject.process.call(emitter, testObj.message, testObj.config)
    expect(emitter.emit.args[2][1]).to.be.instanceOf(Error);
  });

  it('Correctly deletes based on different criteria: allFields ( Date/Time )', async () => {
    testObj = await testObjGen.next() 
    if (!( testObj.value )) {
      throw Error('Test data was not sucessfully created');
    }
    await deleteObject.process.call(emitter, testObj.message, testObj.config)
    expect(emitter.emit.args[2][1].body).to.be.deep.equal(testObj.response);
  });
});
