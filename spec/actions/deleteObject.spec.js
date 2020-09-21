const _ = require('lodash');
const chai = require('chai');
const nock = require('nock');

const { expect } = chai;
const common = require('../../lib/common.js');
const testCommon = require('../common.js');

const deleteObjectAction = require('../../lib/actions/deleteObject.js');
const metaModelDocumentReply = require('../testData/sfDocumentMetadata.json');
const metaModelAccountReply = require('../testData/sfAccountMetadata.json');

describe('Delete Object (at most 1) action', () => {
  before(() => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}`)
      .times(10)
      .reply(200, testCommon.secret);
  });
  describe('Delete Object (at most 1) module: getMetaModel', () => {
    async function testMetaData(configuration, getMetaModelReply) {
      const sfScope = nock(testCommon.instanceUrl)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/${configuration.sobject}/describe`)
        .reply(200, getMetaModelReply);

      const expectedResult = {
        in: {
          type: 'object',
          properties: {},
        },
        out: {
          type: 'object',
          properties: {
            response: {
              type: 'object',
              properties: {
                id: {
                  title: 'id',
                  type: 'string',
                },
                success: {
                  title: 'success',
                  type: 'boolean',
                },
                errors: {
                  title: 'errors',
                  type: 'array',
                },
              },
            },
          },
        },
      };

      if (configuration.lookupField) {
        getMetaModelReply.fields.forEach((field) => {
          const fieldDescriptor = {
            title: field.label,
            default: field.defaultValue,
            type: (() => {
              switch (field.soapType) {
                case 'xsd:boolean':
                  return 'boolean';
                case 'xsd:double':
                  return 'number';
                case 'xsd:int':
                  return 'number';
                case 'urn:address':
                  return 'object';
                default:
                  return 'string';
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
            field.picklistValues.forEach((pick) => {
              fieldDescriptor.enum.push(pick.value);
            });
          }

          if (configuration.lookupField === field.name) {
            expectedResult.in.properties[field.name] = { ...fieldDescriptor, required: true };
          }
        });
      } else {
        expectedResult.in.properties = {
          id: {
            title: 'Object ID',
            type: 'string',
            required: true,
          },
        };
      }

      const data = await deleteObjectAction.getMetaModel.call(testCommon, configuration);
      expect(data).to.deep.equal(expectedResult);
      if (configuration.lookupField) {
        sfScope.done();
      }
    }

    it('Retrieves metadata for Document object', async () => {
      await testMetaData({
        ...testCommon.configuration,
        sobject: 'Document',
        lookupField: 'Id',
      },
      metaModelDocumentReply);
    });

    it('Retrieves metadata for Account object without lookupField', async () => {
      await testMetaData({
        ...testCommon.configuration,
        sobject: 'Account',
      },
      metaModelAccountReply);
    });
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

      const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
        .reply(200, metaModelDocumentReply)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${testCommon.buildSOQL(metaModelDocumentReply,
          { Id: message.body.Id })}`)
        .reply(200, { done: true, totalSize: 1, records: [message.body] })
        .delete(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/testObjId`)
        .reply(200, { id: 'deletedId' });

      const result = await deleteObjectAction.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);
      expect(result.body).to.deep.equal({ response: { id: 'deletedId' } });
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

      const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
        .reply(200, metaModelDocumentReply)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${testCommon.buildSOQL(metaModelDocumentReply,
          { Id: message.body.Id })}`)
        .reply(200, { done: true, totalSize: 1, records: [message.body] })
        .delete(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/testObjId`)
        .reply(200, { id: 'deletedId' });

      nock(testCommon.EXT_FILE_STORAGE).put('/', JSON.stringify(message)).reply(200);

      const result = await deleteObjectAction.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);
      expect(result.body).to.deep.equal({ response: { id: 'deletedId' } });
      scope.done();
    });
  });

  describe('Delete Object (at most 1) module: getLookupFieldsModel', () => {
    async function testUniqueFields(object, getMetaModelReply) {
      const sfScope = nock(testCommon.instanceUrl)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/${object}/describe`)
        .reply(200, getMetaModelReply);

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

    it('Retrieves the list of unique fields of specified sobject', async () => {
      await testUniqueFields.bind(null, 'Document', metaModelDocumentReply);
    });
  });
});
