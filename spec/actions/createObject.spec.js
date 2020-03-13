const chai = require('chai');
const nock = require('nock');
const _ = require('lodash');

const common = require('../../lib/common.js');
const testCommon = require('../common.js');
const objectTypesReply = require('../sfObjects.json');
const metaModelDocumentReply = require('../sfDocumentMetadata.json');
const metaModelAccountReply = require('../sfAccountMetadata.json');
const createObject = require('../../lib/actions/createObject.js');

// Disable real HTTP requests
nock.disableNetConnect();

describe('Create Object module: objectTypes', () => {
  it('Retrieves the list of createable sobjects', async () => {
    const scope = nock(testCommon.configuration.oauth.instance_url)
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects`)
      .reply(200, objectTypesReply);

    const expectedResult = {};
    objectTypesReply.sobjects.forEach((object) => {
      if (object.createable) expectedResult[object.name] = object.label;
    });

    const result = await createObject.objectTypes.call(testCommon, testCommon.configuration);
    chai.expect(result).to.deep.equal(expectedResult);

    scope.done();
  });
});

describe('Create Object module: getMetaModel', () => {
  function testMetaData(object, getMetaModelReply) {
    const sfScope = nock(testCommon.configuration.oauth.instance_url)
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/${object}/describe`)
      .reply(200, getMetaModelReply);

    nock(testCommon.refresh_token.url)
      .post('')
      .reply(200, testCommon.refresh_token.response);

    const expectedResult = {
      in: {
        description: object,
        type: 'object',
        properties: {},
      },
    };
    getMetaModelReply.fields.forEach((field) => {
      if (field.createable) {
        const fieldDescriptor = {
          title: field.label,
          custom: field.custom,
          default: field.defaultValue,
          type: (() => {
            switch (field.soapType) {
              case 'xsd:boolean': return 'boolean';
              case 'xsd:double': return 'number';
              case 'xsd:int': return 'integer';
              default: return 'string';
            }
          })(),
          required: !field.nillable && !field.defaultedOnCreate,
          readonly: field.calculated || !field.updateable,
        };

        if (field.picklistValues !== undefined && field.picklistValues.length !== 0) {
          fieldDescriptor.enum = [];
          field.picklistValues.forEach((pick) => { fieldDescriptor.enum.push(pick.value); });
        }

        expectedResult.in.properties[field.name] = fieldDescriptor;
      }
    });
    expectedResult.out = _.cloneDeep(expectedResult.in);
    expectedResult.out.properties.id = {
      type: 'string',
      required: true,
      readonly: true,
      title: 'ObjectID',
    };

    return new Promise(((resolve, reject) => {
      testCommon.configuration.sobject = object;
      createObject.getMetaModel.call(testCommon, testCommon.configuration, (err, data) => {
        if (err) reject(err);

        resolve(data);
      });
    })).then((data) => {
      chai.expect(data).to.deep.equal(expectedResult);
      sfScope.done();
      // sfRefreshTokenScope.done();
    });
  }

  it('Retrieves metadata for Document object', testMetaData.bind(null, 'Document', metaModelDocumentReply));
  it('Retrieves metadata for Account object', testMetaData.bind(null, 'Account', metaModelAccountReply));
});

describe('Create Object module: createObject', () => {
  it('Sends request for Account creation', async () => {
    const message = {
      body: {
        Name: 'Fred',
        BillingStreet: 'Elm Street',
      },
    };

    nock(testCommon.configuration.oauth.instance_url)
      .post(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Account`, message.body)
      .reply(200, {
        id: 'new_account_id',
        success: true,
      });

    testCommon.configuration.sobject = 'Account';
    const result = await createObject.process
      .call(testCommon, _.cloneDeep(message), testCommon.configuration);

    message.body.id = 'new_account_id';
    chai.expect(result.body).to.deep.equal(message.body);
  });

  it('Sends request for Document creation not using input attachment', async () => {
    const message = {
      body: {
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

    nock(testCommon.configuration.oauth.instance_url)
      .post(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document`, message.body)
      .reply(200, {
        id: 'new_document_id',
        success: true,
      });

    testCommon.configuration.sobject = 'Document';
    testCommon.configuration.utilizeAttachment = false;

    const result = await createObject.process
      .call(testCommon, _.cloneDeep(message), testCommon.configuration);

    message.body.id = 'new_document_id';
    chai.expect(result.body).to.deep.equal(message.body);
  });

  it('Sends request for Document creation using input attachment', async () => {
    const message = {
      body: {
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
    resultRequestBody.Body = Buffer.from(JSON.stringify(message)).toString('base64'); // Take the message as binary data
    resultRequestBody.ContentType = message.attachments.theFile['content-type'];

    const newDocID = 'new_document_id';

    const sfScope = nock(testCommon.configuration.oauth.instance_url)
      .post(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document`, resultRequestBody)
      .reply(200, {
        id: newDocID,
        success: true,
      })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
      .reply(200, metaModelDocumentReply);

    const binaryScope = nock('https://upload.wikimedia.org')
      .get('/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg')
      .reply(200, JSON.stringify(message));

    testCommon.configuration.sobject = 'Document';
    testCommon.configuration.utilizeAttachment = true;

    const result = await createObject.process
      .call(testCommon, _.cloneDeep(message), testCommon.configuration);

    resultRequestBody.id = newDocID;
    delete resultRequestBody.Body;
    chai.expect(result.body).to.deep.equal(resultRequestBody);

    sfScope.done();
    binaryScope.done();
  });
});
