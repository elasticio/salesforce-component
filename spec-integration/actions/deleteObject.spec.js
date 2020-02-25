/* eslint-disable no-return-assign,no-unused-expressions */

const sinon = require('sinon');
const chai = require('chai');
const logger = require('@elastic.io/component-logger')();
const deleteObject = require('../../lib/actions/deleteObject');
const { testDataFactory } = require('../../lib/helpers/deleteObjectHelpers.js');

const { expect } = chai;

describe('Delete Object Integration Functionality', () => {
  let emitter;
  let testObjLst;

  before(async () => {
    // eslint-disable-next-line global-require
    require('dotenv').config({ path: `${__dirname}/.env` });

    emitter = {
      emit: sinon.spy(),
      logger,
    };

    testObjLst = await testDataFactory.call(emitter);
    if (!(testObjLst)) {
      throw Error('Test data was not successfully created');
    }
  });

  beforeEach(() => {
    emitter.emit.resetHistory();
  });

  it('Correctly identifies a lack of response on a non-existent Contact', async () => {
    await deleteObject.process.call(emitter, testObjLst[0].message, testObjLst[0].config);
    expect(emitter.emit.args[2][1].body).to.be.empty;
  });

  it('Correctly deletes an existent Contact', async () => {
    const testObj = await deleteObject.process.call(
      emitter, testObjLst[1].message, testObjLst[1].config,
    );
    expect(emitter.emit.args[2][1].body).to.be.deep.equal(testObj.response);
  });

  it('Correctly identifies when more than one object is found and throws', async () => {
    await deleteObject.process.call(emitter, testObjLst[2].message, testObjLst[2].config);
    expect(emitter.emit.args[2][1]).to.be.instanceOf(Error);
  });

  it('Correctly deletes based on different criteria: allFields ( Date/Time )', async () => {
    const testObj = await deleteObject.process.call(
      emitter, testObjLst[3].message, testObjLst[3].config,
    );
    expect(emitter.emit.args[2][1].body).to.be.deep.equal(testObj.response);
  });
});
