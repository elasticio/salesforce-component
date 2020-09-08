/* eslint-disable max-len */
const chai = require('chai');
const nock = require('nock');
const _ = require('lodash');

const common = require('../../lib/common.js');
const testCommon = require('../common.js');
const objectTypesReply = require('../sfObjects.json');
const metaModelDocumentReply = require('../sfDocumentMetadata.json');
const metaModelAccountReply = require('../sfAccountMetadata.json');
const upsertObject = require('../../lib/actions/upsert.js');

// Disable real HTTP requests
nock.disableNetConnect();
nock(process.env.ELASTICIO_API_URI)
  .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}`)
  .times(10)
  .reply(200, testCommon.secret);

describe('Upsert Object test', () => {
  describe('Upsert Object module: objectTypes', () => {
    it('Retrieves the list of createable/updateable sobjects', async () => {
      const scope = nock(testCommon.instanceUrl)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects`)
        .reply(200, objectTypesReply);

      const expectedResult = {};
      objectTypesReply.sobjects.forEach((object) => {
        if (object.createable && object.updateable) expectedResult[object.name] = object.label;
      });

      const result = await upsertObject.objectTypes.call(testCommon, testCommon.configuration);
      chai.expect(result).to.deep.equal(expectedResult);

      scope.done();
    });
  });

  describe('Upsert Object module: getMetaModel', () => {
    function testMetaData(object, getMetaModelReply) {
      const sfScope = nock(testCommon.instanceUrl)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/${object}/describe`)
        .reply(200, getMetaModelReply);

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
        if (field.createable) {
          const fieldDescriptor = {
            title: field.label,
            default: field.defaultValue,
            type: (() => {
              switch (field.soapType) {
                case 'xsd:boolean': return 'boolean';
                case 'xsd:double': return 'number';
                case 'xsd:int': return 'number';
                default: return 'string';
              }
            })(),
            required: !field.nillable && !field.defaultedOnCreate,
          };

          if (field.type === 'textarea') fieldDescriptor.maxLength = 1000;

          if (field.picklistValues !== undefined && field.picklistValues.length !== 0) {
            fieldDescriptor.enum = [];
            field.picklistValues.forEach((pick) => { fieldDescriptor.enum.push(pick.value); });
          }

          expectedResult.in.properties[field.name] = { ...fieldDescriptor, required: false };
          expectedResult.out.properties[field.name] = fieldDescriptor;
        }
      });

      expectedResult.in.properties.Id = {
        type: 'string',
        required: false,
        title: 'Id',
      };

      testCommon.configuration.sobject = object;
      return upsertObject.getMetaModel.call(testCommon, testCommon.configuration)
        .then((data) => {
          chai.expect(data).to.deep.equal(expectedResult);
          sfScope.done();
        });
    }

    it('Retrieves metadata for Document object', testMetaData.bind(null, 'Document', metaModelDocumentReply));
    it('Retrieves metadata for Account object', testMetaData.bind(null, 'Account', metaModelAccountReply));
  });

  describe('Upsert Object module: upsertObject', () => {
    it('Sends request for Document update not using input attachment', async () => {
      const message = {
        body: {
          Id: 'testObjId',
          FolderId: 'xxxyyyzzz',
          Name: 'NotVeryImportantDoc',
          IsPublic: false,
          Body: 'not quite binary data',
          ContentType: 'application/octet-stream',
        },
        attachments: {
          theFile: {
            url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
            'content-type': 'image/jpeg',
          },
        },
      };

      const resultRequestBody = _.cloneDeep(message.body);
      delete resultRequestBody.Id;

      const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
        .patch(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/${message.body.Id}`, resultRequestBody)
        .reply(204)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
        .reply(200, metaModelDocumentReply)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${testCommon.buildSOQL(metaModelDocumentReply, { Id: message.body.Id })}`)
        .reply(200, { done: true, totalSize: 1, records: [message.body] });

      testCommon.configuration.sobject = 'Document';
      testCommon.configuration.utilizeAttachment = false;

      const getResult = new Promise((resolve) => {
        testCommon.emitCallback = (what, msg) => {
          if (what === 'data') resolve(msg);
        };
      });

      await upsertObject.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);
      const result = await getResult;

      chai.expect(result.body).to.deep.equal(message.body);
      scope.done();
    });

    it('Sends request for Document update using input attachment', async () => {
      const message = {
        body: {
          Id: 'testObjId',
          FolderId: 'xxxyyyzzz',
          Name: 'NotVeryImportantDoc',
          IsPublic: false,
          Body: 'not quite binary data',
          ContentType: 'application/octet-stream',
        },
        attachments: {
          theFile: {
            url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
            'content-type': 'image/jpeg',
          },
        },
      };

      const resultRequestBody = _.cloneDeep(message.body);
      delete resultRequestBody.Id;
      resultRequestBody.Body = Buffer.from(JSON.stringify(message)).toString('base64'); // Take the message as binary data
      resultRequestBody.ContentType = message.attachments.theFile['content-type'];

      const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
        .patch(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/${message.body.Id}`, resultRequestBody)
        .reply(204)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
        .times(2)
        .reply(200, metaModelDocumentReply)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${testCommon.buildSOQL(metaModelDocumentReply, { Id: message.body.Id })}`)
        .reply(200, { done: true, totalSize: 1, records: [message.body] });

      const binaryScope = nock('https://upload.wikimedia.org')
        .get('/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg')
        .reply(200, JSON.stringify(message));

      testCommon.configuration.sobject = 'Document';
      testCommon.configuration.utilizeAttachment = true;

      const getResult = new Promise((resolve) => {
        testCommon.emitCallback = (what, msg) => {
          if (what === 'data') resolve(msg);
        };
      });

      await upsertObject.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);
      const result = await getResult;

      chai.expect(result.body).to.deep.equal(message.body);
      scope.done();
      binaryScope.done();
    });
  });
});
