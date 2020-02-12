/* eslint-disable no-return-assign */
const sinon = require('sinon');
const chai = require('chai');
const logger = require('@elastic.io/component-logger')();
const deleteObject = require('../../lib/actions/deleteObject');
const { testDataFactory } = require('../../lib/helpers/deleteObjectHelpers');

const { expect } = chai;

describe('Delete Object Integration Functionality', () => {

  var emitter;
  let testObjLst;

  before(async () => {
    // eslint-disable-next-line global-require
    require('dotenv').config({path:__dirname+'/secrets.env'}); 

    emitter = {
      emit: sinon.spy(),
      logger,
    };

    if (!( testObjLst = testDataFactory.call(emitter) )) {
      throw Error('Test data was not sucessfully created');
    }
  });

  beforeEach(() => {
    emitter.emit.resetHistory();
  })

  it('Correctly identifies a lack of response on a non-existent Contact', async () => {
    await deleteObject.process.call(emitter, testObjLst[0].message, testObjLst[0].config)
    expect(emitter.emit.args[2][1].body).to.be.empty;
  });

  it('Correctly deletes an existent Contact', async () => {
    testObj = await testObjGen.next() 
    if (!( testObj.value )) {
      throw Error('Test data was not sucessfully created');
    }
    await deleteObject.process.call(emitter, testObjLst[1].message, testObjLst[1].config)
    expect(emitter.emit.args[2][1].body).to.be.deep.equal(testObj.response);
  });

  it('Correctly identifies when more than one object is found and throws', async () => {
    testObj = await testObjGen.next() 
    if (!( testObj.value )) {
      throw Error('Test data was not sucessfully created');
    }
    await deleteObject.process.call(emitter, testObjLst[2].message, testObjLst[2].config)
    expect(emitter.emit.args[2][1]).to.be.instanceOf(Error);
  });

  it('Correctly deletes based on different criteria: allFields ( Date/Time )', async () => {
    testObj = await testObjGen.next() 
    if (!( testObj.value )) {
      throw Error('Test data was not sucessfully created');
    }
    await deleteObject.process.call(emitter, testObjLst[3].message, testObjLst[3].config)
    expect(emitter.emit.args[2][1].body).to.be.deep.equal(testObj.response);
  });
});
