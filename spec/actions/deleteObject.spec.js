/* eslint-disable no-restricted-syntax,guard-for-in */

const _ = require('lodash');
const chai = require('chai');
const nock = require('nock');
const sinon = require('sinon');

const common = require('../../lib/common.js');
const testCommon = require('../common.js');
const testDeleteData = require('./deleteObject.json');
const deleteObjectAction = require('../../lib/actions/deleteObject.js');
const helpers = require('../../lib/helpers/deleteObjectHelpers.js');

const metaModelDocumentReply = require('../sfDocumentMetadata.json');
const metaModelAccountReply = require('../sfAccountMetadata.json');

nock.disableNetConnect();

const { expect } = chai;

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

      if (field.picklistValues !== undefined && field.picklistValues.length !== 0) {
        fieldDescriptor.enum = [];
        field.picklistValues.forEach((pick) => { fieldDescriptor.enum.push(pick.value); });
      }

      if (configuration.lookupField === field.name) {
        expectedResult.in.properties[field.name] = { ...fieldDescriptor, required: true };
      }

      expectedResult.out.properties[field.name] = fieldDescriptor;
    });

    return deleteObjectAction.getMetaModel.call(testCommon, configuration)
      .then((data) => {
        expect(data).to.deep.equal(expectedResult);
        sfScope.done();
      });
  }

  it('Retrieves metadata for Document object', testMetaData.bind(null, {
    ...testCommon.configuration,
    sobject: 'Document',
    lookupField: 'Id',
  },
  metaModelDocumentReply));

  it('Retrieves metadata for Account object', testMetaData.bind(null, {
    ...testCommon.configuration,
    sobject: 'Account',
    lookupField: 'Id',
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
      .reply(200, { done: true, totalSize: 1, records: [message.body] });

    const stub = sinon.stub(helpers, 'deleteObjById');
    stub.resolves(true);
    await deleteObjectAction.process.call(
      testCommon, _.cloneDeep(message), testCommon.configuration,
    );
    expect(stub.calledOnce).to.equal(true);
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

    const stub = sinon.stub(helpers, 'deleteObjById');
    stub.resolves(true);
    await deleteObjectAction.process.call(
      testCommon, _.cloneDeep(message), testCommon.configuration,
    );
    expect(stub.calledOnce).to.equal(true);
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

    const result = await deleteObjectAction.getLookupFieldsModel.call(
      testCommon, testCommon.configuration,
    );

    chai.expect(result).to.deep.equal(expectedResult);
    sfScope.done();
  }

  it('Retrieves the list of unique fields of specified sobject', testUniqueFields.bind(null, 'Document', metaModelDocumentReply));
});

describe('Delete Object (at most 1) module: deleteObjById', () => {
  async function testDeleteDataFunc(id, objType, expectedRes) {
    const method = () => new Promise((resolve) => { resolve(expectedRes); });
    const sfConnSpy = sinon.spy(method);
    const sfConn = {
      sobject: () => ({
        delete: sfConnSpy,
      }),
    };

    const getResult = new Promise((resolve) => {
      testCommon.emitCallback = function (what, msg) {
        if (what === 'data') resolve(msg);
      };
    });

    await helpers.deleteObjById.call(testCommon, sfConn, id, objType);
    const actualRes = await getResult;

    expect(actualRes).to.have.all.keys(expectedRes);
    expect(sfConnSpy.calledOnceWithExactly(id)).to.equal(true);
  }

  it('properly deletes an object and emits the correct data based on a Case obj', async () => {
    await testDeleteDataFunc(
      testDeleteData.cases[0].body.response.id,
      testDeleteData.cases[0].body.request.sobject,
      testDeleteData.cases[0],
    );
  });
  it('properly deletes an object and emits the correct data based on an Account obj', async () => {
    await testDeleteDataFunc(
      testDeleteData.cases[1].body.response.id,
      testDeleteData.cases[1].body.request.sobject,
      testDeleteData.cases[1],
    );
  });
  it('properly deletes an object and emits the correct data based on a Custom SalesForce sObject', async () => {
    await testDeleteDataFunc(
      testDeleteData.cases[2].body.response.id,
      testDeleteData.cases[2].body.request.sobject,
      testDeleteData.cases[2],
    );
  });
});
