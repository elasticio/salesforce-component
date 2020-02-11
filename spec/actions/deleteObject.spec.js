/* eslint-disable no-return-assign */
<<<<<<< HEAD
/**
 * Note: The order of tests is congruent to their declaration in deleteObject.js action
 * Note: Most of the tests are adapted from the lookupObject.spec.js file as many 
 * of the functions are resued
 * Adapted by C.J.V
 */
const _ = require('lodash');
const chai = require('chai');
const nock = require('nock');
const sinon = require('sinon');

const common = require('../../lib/common.js');
const testCommon = require('../common.js');
const objectTypesReply = require('../sfObjects.json');
const testDeleteData = require('./deleteObject.json');
const deleteObjectAction = require('../../lib/actions/deleteObject.js');
const helpers = require('../../lib/helpers/deleteObjectHelpers.js')

const metaModelDocumentReply = require('../sfDocumentMetadata.json');
const metaModelAccountReply = require('../sfAccountMetadata.json');

nock.disableNetConnect();

describe('Delete Object (at most 1) module: objectTypes', () => {
  it('Retrieves the list of queryable sobjects', async () => {
    const scope = nock(testCommon.configuration.oauth.instance_url)
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects`)
      .reply(200, objectTypesReply);

    const expectedResult = {};
    objectTypesReply.sobjects.forEach((object) => {
      if (object.queryable) expectedResult[object.name] = object.label;
    });

    const result = await deleteObjectAction.objectTypes.call(testCommon, testCommon.configuration);
    chai.expect(result).to.deep.equal(expectedResult);

    scope.done();
  });
});

describe('Delete Object (at most 1) module: getMetaModel', () => {
  function testMetaData(configuration, getMetaModelReply) {
    const sfScope = nock(testCommon.configuration.oauth.instance_url)
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/${configuration.sobject}/describe`)
      .reply(200, getMetaModelReply);

    nock(testCommon.refresh_token.url)
      .post('')
      .reply(200, testCommon.refresh_token.response);

    const expectedResult = {
      in: {
        type: 'object',
        properties: {},
      },
      out: {
        type: 'object',
        properties: {},
      },
    };

    getMetaModelReply.fields.forEach((field) => {
      const fieldDescriptor = {
        title: field.label,
        default: field.defaultValue,
        type: (() => {
          switch (field.soapType) {
            case 'xsd:boolean': return 'boolean';
            case 'xsd:double': return 'number';
            case 'xsd:int': return 'number';
            case 'urn:address': return 'object';
            default: return 'string';
          }
        })(),
        required: !field.nillable && !field.defaultedOnCreate,
      };

      if (field.soapType === 'urn:address') {
        fieldDescriptor.properties = {
          city: { type: 'string' },
          country: { type: 'string' },
          postalCode: { type: 'string' },
          state: { type: 'string' },
          street: { type: 'string' },
        };
      }

      if (field.type === 'textarea') fieldDescriptor.maxLength = 1000;

      if (field.picklistValues != undefined && field.picklistValues.length != 0) {
        fieldDescriptor.enum = [];
        field.picklistValues.forEach((pick) => { fieldDescriptor.enum.push(pick.value); });
      }

      if (configuration.lookupField === field.name) expectedResult.in.properties[field.name] = { ...fieldDescriptor, required: true };

      expectedResult.out.properties[field.name] = fieldDescriptor;
    });

    return deleteObjectAction.getMetaModel.call(testCommon, configuration)
      .then((data) => {
        chai.expect(data).to.deep.equal(expectedResult);
        sfScope.done();
      });
  }

  it('Retrieves metadata for Document object', testMetaData.bind(null, {
    ...testCommon.configuration,
    sobject: 'Document',
    lookupField: 'Id',
    allowCriteriaToBeOmitted: true,
  },
  metaModelDocumentReply));

  it('Retrieves metadata for Account object', testMetaData.bind(null, {
    ...testCommon.configuration,
    sobject: 'Account',
    lookupField: 'Id',
    allowCriteriaToBeOmitted: true,
  },
  metaModelAccountReply));
});

describe('Delete Object (at most 1) module: process', () => {
  it('Deletes a document object without an attachment', async () => {
    testCommon.configuration.sobject = 'Document';
    testCommon.configuration.lookupField = 'Id';

    const message = {
      body: {
        Id: 'testObjId',
        FolderId: 'xxxyyyzzz',
        Name: 'NotVeryImportantDoc',
        IsPublic: false,
        Body: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
        ContentType: 'image/jpeg',
      },
    };

    const scope = nock(testCommon.configuration.oauth.instance_url, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
      .reply(200, metaModelDocumentReply)
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${testCommon.buildSOQL(metaModelDocumentReply, { Id: message.body.Id })}`)
      .reply(200, { done: true, totalSize: 1, records: [message.body] })

    let stub = sinon.stub(helpers, "deleteObjById");
    stub.resolves(true);
  await deleteObjectAction.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);
    chai.expect(stub.calledOnce).to.be.true;
    stub.restore();
    scope.done();
  });

  it('Deletes a document object with an attachment', async () => {
    testCommon.configuration.sobject = 'Document';
    testCommon.configuration.lookupField = 'Id';

    const message = {
      body: {
        Id: 'testObjId',
        FolderId: 'xxxyyyzzz',
        Name: 'NotVeryImportantDoc',
        IsPublic: false,
        Body: '/upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
        ContentType: 'image/jpeg',
      },
    };

      const scope = nock(testCommon.configuration.oauth.instance_url, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
      .reply(200, metaModelDocumentReply)
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${testCommon.buildSOQL(metaModelDocumentReply, { Id: message.body.Id })}`)
      .reply(200, { done: true, totalSize: 1, records: [message.body] });

    nock(testCommon.EXT_FILE_STORAGE).put('', JSON.stringify(message)).reply(200);

    let stub = sinon.stub(helpers, "deleteObjById");
    stub.resolves(true);
    await deleteObjectAction.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);
    chai.expect(stub.calledOnce).to.be.true;
    stub.restore();
    scope.done();
  });
});

describe('Delete Object (at most 1) module: getLookupFieldsModel', () => {
  async function testUniqueFields(object, getMetaModelReply) {
    const sfScope = nock(testCommon.configuration.oauth.instance_url)
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/${object}/describe`)
      .reply(200, getMetaModelReply);

    nock(testCommon.refresh_token.url)
      .post('')
      .reply(200, testCommon.refresh_token.response);

    const expectedResult = {};
    getMetaModelReply.fields.forEach((field) => {
      if (field.type === 'id' || field.unique) expectedResult[field.name] = `${field.label} (${field.name})`;
    });

    testCommon.configuration.typeOfSearch = 'uniqueFields';
    testCommon.configuration.sobject = object;

    const result = await deleteObjectAction.getLookupFieldsModel.call(testCommon, testCommon.configuration);

    chai.expect(result).to.deep.equal(expectedResult);
    sfScope.done();
  }

  it('Retrieves the list of unique fields of specified sobject', testUniqueFields.bind(null, 'Document', metaModelDocumentReply));
});

describe('Delete Object (at most 1) module: deleteObjById', () => {
  async function testDeleteDataFunc(id, objType, expectedRes) {
    
    const method = () => { return new Promise((resolve) => {resolve(expectedRes)}); };
    const sfConnSpy = sinon.spy(method);
    const sfConn = {
      sobject: () => {
        return {
          delete: sfConnSpy
        }
      }
    }

    const getResult = new Promise((resolve) => {
      testCommon.emitCallback = function (what, msg) {
        if (what === 'data') resolve(msg);
      };
    });

    await helpers.deleteObjById.call(testCommon, sfConn, id, objType)
    const actualRes = await getResult;

    chai.expect(actualRes).to.have.all.keys(expectedRes);
    chai.expect(sfConnSpy.calledOnceWithExactly(id)).to.be.true;
  }

  it('properly deletes an object and emits the correct data based on a Case obj', async () => {
    await testDeleteDataFunc(
      testDeleteData.cases[0].body.response.id,
      testDeleteData.cases[0].body.request.sobject,
      testDeleteData.cases[0],
      )
    }
  );
  it('properly deletes an object and emits the correct data based on an Account obj', async () => { 
    await testDeleteDataFunc(
      testDeleteData.cases[1].body.response.id,
      testDeleteData.cases[1].body.request.sobject,
      testDeleteData.cases[1],
      )
    }
  );
  it('properly deletes an object and emits the correct data based on a Custom Salesforce sObject', async () => {
    await testDeleteDataFunc(
      testDeleteData.cases[2].body.response.id,
      testDeleteData.cases[2].body.request.sobject,
      testDeleteData.cases[2],
      )
    }
  );
=======
const chai = require('chai');
const nock = require('nock');

const testCommon = require('../common.js');
const testData = require('./deleteObject.json');
const deleteObject = require('../../lib/actions/deleteObject.js');

nock.disableNetConnect();

describe('Salesforce delete object', () => {
  beforeEach(async () => {
    nock(testCommon.refresh_token.url)
      .post('')
      .reply(200, testCommon.refresh_token.response);
  });

  it('action delete', async () => {
    const data = testData.deleteObject;
    data.configuration = { ...testCommon.configuration, ...data.configuration };

    const expectedResult = { id: '5002o00002E8F3NAAV', success: true, errors: [] };

    const scopes = [];
    for (const host in data.responses) {
      for (const path in data.responses[host]) {
        scopes.push(nock(host)
          .intercept(path, data.responses[host][path].method)
          .reply(200, data.responses[host][path].response, data.responses[host][path].header));
      }
    }
    const response = await deleteObject.process.call(testCommon, data.message, data.configuration);
    chai.expect(response.body.result).to.deep.equal(expectedResult);

    for (let i = 0; i < scopes.length; i++) {
      scopes[i].done();
    }
  });
>>>>>>> 865ca3a2219cbc12f479ab30f9a1ac8ea340852f
});
