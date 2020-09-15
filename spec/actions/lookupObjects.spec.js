const chai = require('chai');
const nock = require('nock');
const _ = require('lodash');

const common = require('../../lib/common.js');
const testCommon = require('../common.js');
const objectTypesReply = require('../sfObjects.json');
const metaModelDocumentReply = require('../sfDocumentMetadata.json');
const metaModelAccountReply = require('../sfAccountMetadata.json');

process.env.HASH_LIMIT_TIME = 1000;
const lookupObjects = require('../../lib/actions/lookupObjects.js');

const COMPARISON_OPERATORS = ['=', '!=', '<', '<=', '>', '>=', 'LIKE', 'IN', 'NOT IN', 'INCLUDES', 'EXCLUDES'];

// Disable real HTTP requests
nock.disableNetConnect();

describe('Lookup Objects action test', () => {
  beforeEach(async () => {
    nock(process.env.ELASTICIO_API_URI)
      .get(`/v2/workspaces/${process.env.ELASTICIO_WORKSPACE_ID}/secrets/${testCommon.secretId}`)
      .times(10)
      .reply(200, testCommon.secret);
  });
  describe('Lookup Objects module: objectTypes', () => {
    it('Retrieves the list of queryable sobjects', async () => {
      const scope = nock(testCommon.instanceUrl)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects`)
        .reply(200, objectTypesReply);

      const expectedResult = {};
      objectTypesReply.sobjects.forEach((object) => {
        if (object.queryable) expectedResult[object.name] = object.label;
      });

      const result = await lookupObjects.objectTypes.call(testCommon, testCommon.configuration);
      chai.expect(result).to.deep.equal(expectedResult);

      scope.done();
    });
  });

  describe('Lookup Objects module: getMetaModel', () => {
    function testMetaData(configuration, getMetaModelReply) {
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
            results: {
              type: 'array',
              required: true,
              properties: {},
            },
          },
        },
      };

      if (configuration.outputMethod === 'emitPage') {
        expectedResult.in.properties.pageSize = {
          title: 'Page size',
          type: 'number',
          required: false,
        };
        expectedResult.in.properties.pageNumber = {
          title: 'Page number',
          type: 'number',
          required: true,
        };
      } else {
        expectedResult.in.properties.limit = {
          title: 'Maximum number of records',
          type: 'number',
          required: false,
        };
      }

      const filterableFields = [];
      getMetaModelReply.fields.forEach((field) => {
        if (!field.deprecatedAndHidden) {
          if (field.filterable && field.type !== 'address' && field.type !== 'location') { // Filter out compound fields
            filterableFields.push(field.label);
          }

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
            expectedResult.in.properties[field.name] = {
              ...fieldDescriptor, required: !configuration.allowCriteriaToBeOmitted,
            };
          }

          expectedResult.out.properties.results.properties[field.name] = fieldDescriptor;
        }
      });

      filterableFields.sort();

      // eslint-disable-next-line no-plusplus
      for (let i = 1; i <= configuration.termNumber; i += 1) {
        expectedResult.in.properties[`sTerm_${i}`] = {
          title: `Search term ${i}`,
          type: 'object',
          required: true,
          properties: {
            fieldName: {
              title: 'Field name',
              type: 'string',
              required: true,
              enum: filterableFields,
            },
            condition: {
              title: 'Condition',
              type: 'string',
              required: true,
              enum: COMPARISON_OPERATORS,
            },
            fieldValue: {
              title: 'Field value',
              type: 'string',
              required: true,
            },
          },
        };

        if (i !== parseInt(configuration.termNumber, 10)) {
          expectedResult.in.properties[`link_${i}_${i + 1}`] = {
            title: 'Logical operator',
            type: 'string',
            required: true,
            enum: ['AND', 'OR'],
          };
        }
      }

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
          expectedResult.in.properties[field.name] = {
            ...fieldDescriptor, required: !configuration.allowCriteriaToBeOmitted,
          };
        }

        expectedResult.out.properties.results.properties[field.name] = fieldDescriptor;
      });

      return lookupObjects.getMetaModel.call(testCommon, configuration)
        .then((data) => {
          chai.expect(data).to.deep.equal(expectedResult);
          sfScope.done();
        });
    }

    it('Retrieves metadata for Document object', testMetaData.bind(null, {
      ...testCommon.configuration,
      sobject: 'Document',
      outputMethod: 'emitAll',
      termNumber: '1',
    },
    metaModelDocumentReply));

    it('Retrieves metadata for Document object 2 terms', testMetaData.bind(null, {
      ...testCommon.configuration,
      sobject: 'Document',
      outputMethod: 'emitAll',
      termNumber: '2',
    },
    metaModelDocumentReply));

    it('Retrieves metadata for Account object', testMetaData.bind(null, {
      ...testCommon.configuration,
      sobject: 'Account',
      outputMethod: 'emitPage',
      termNumber: '2',
    },
    metaModelAccountReply));
  });

  describe('Lookup Objects module: processAction', () => {
    it('Gets Document objects: 2 string search terms, emitAll, limit', () => {
      testCommon.configuration.sobject = 'Document';
      testCommon.configuration.includeDeleted = false;
      testCommon.configuration.outputMethod = 'emitAll';
      testCommon.configuration.termNumber = '2';

      const message = {
        body: {
          limit: 30,
          sTerm_1: {
            fieldName: 'Document Name',
            fieldValue: 'NotVeryImportantDoc',
            condition: '=',
          },
          link_1_2: 'AND',
          sTerm_2: {
            fieldName: 'Folder ID',
            fieldValue: 'Some folder ID',
            condition: '=',
          },
        },
      };

      const testReply = {
        results: [{
          Id: 'testObjId',
          FolderId: 'xxxyyyzzz',
          Name: 'NotVeryImportantDoc',
          IsPublic: false,
          Body: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
          ContentType: 'imagine/noHeaven',
        },
        {
          Id: 'testObjId',
          FolderId: '123yyyzzz',
          Name: 'VeryImportantDoc',
          IsPublic: true,
          Body: 'wikipedia.org',
          ContentType: 'imagine/noHell',
        },
        ],
      };

      let expectedQuery = testCommon.buildSOQL(metaModelDocumentReply,
        `Name%20%3D%20%27${message.body.sTerm_1.fieldValue}%27%20`
      + `${message.body.link_1_2}%20`
      + `FolderId%20%3D%20%27${message.body.sTerm_2.fieldValue}%27%20`
      + `%20LIMIT%20${message.body.limit}`);
      expectedQuery = expectedQuery.replace(/ /g, '%20');

      const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
        .reply(200, metaModelDocumentReply)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${expectedQuery}`)
        .reply(200, { done: true, totalSize: testReply.results.length, records: testReply.results });

      lookupObjects.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);
      return new Promise((resolve) => {
        testCommon.emitCallback = (what, msg) => {
          if (what === 'data') {
            chai.expect(msg.body).to.deep.equal(testReply);
            scope.done();
            resolve();
          }
        };
      });
    });

    it('Gets Document objects: 2 string search terms, IN operator, emitAll, limit', () => {
      testCommon.configuration.sobject = 'Document';
      testCommon.configuration.includeDeleted = false;
      testCommon.configuration.outputMethod = 'emitAll';
      testCommon.configuration.termNumber = '2';

      const message = {
        body: {
          limit: 30,
          sTerm_1: {
            fieldName: 'Document Name',
            fieldValue: 'NotVeryImportantDoc,Value_1,Value_2',
            condition: 'IN',
          },
          link_1_2: 'AND',
          sTerm_2: {
            fieldName: 'Folder ID',
            fieldValue: 'Some folder ID',
            condition: '=',
          },
        },
      };

      const testReply = {
        results: [{
          Id: 'testObjId',
          FolderId: 'xxxyyyzzz',
          Name: 'NotVeryImportantDoc',
          IsPublic: false,
          Body: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
          ContentType: 'imagine/noHeaven',
        },
        {
          Id: 'testObjId',
          FolderId: '123yyyzzz',
          Name: 'VeryImportantDoc',
          IsPublic: true,
          Body: 'wikipedia.org',
          ContentType: 'imagine/noHell',
        },
        ],
      };

      let expectedQuery = testCommon.buildSOQL(metaModelDocumentReply,
        'Name%20IN%20(%27NotVeryImportantDoc%27%2C%27Value_1%27%2C%27Value_2%27)%20'
      + `${message.body.link_1_2}%20`
      + `FolderId%20%3D%20%27${message.body.sTerm_2.fieldValue}%27%20`
      + `%20LIMIT%20${message.body.limit}`);
      expectedQuery = expectedQuery.replace(/ /g, '%20');

      const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
        .reply(200, metaModelDocumentReply)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${expectedQuery}`)
        .reply(200, { done: true, totalSize: testReply.results.length, records: testReply.results });

      lookupObjects.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);

      return new Promise((resolve) => {
        testCommon.emitCallback = (what, msg) => {
          if (what === 'data') {
            chai.expect(msg.body).to.deep.equal(testReply);
            scope.done();
            resolve();
          }
        };
      });
    });

    it('Gets Document objects: 2 string search terms, NOT IN operator, emitAll, limit', () => {
      testCommon.configuration.sobject = 'Document';
      testCommon.configuration.includeDeleted = false;
      testCommon.configuration.outputMethod = 'emitAll';
      testCommon.configuration.termNumber = '2';

      const message = {
        body: {
          limit: 30,
          sTerm_1: {
            fieldName: 'Body Length',
            fieldValue: '32,12,234',
            condition: 'NOT IN',
          },
          link_1_2: 'AND',
          sTerm_2: {
            fieldName: 'Folder ID',
            fieldValue: 'Some folder ID',
            condition: '=',
          },
        },
      };

      const testReply = {
        results: [{
          Id: 'testObjId',
          FolderId: 'xxxyyyzzz',
          Name: 'NotVeryImportantDoc',
          IsPublic: false,
          Body: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
          ContentType: 'imagine/noHeaven',
        },
        {
          Id: 'testObjId',
          FolderId: '123yyyzzz',
          Name: 'VeryImportantDoc',
          IsPublic: true,
          Body: 'wikipedia.org',
          ContentType: 'imagine/noHell',
        },
        ],
      };

      let expectedQuery = testCommon.buildSOQL(metaModelDocumentReply,
        'BodyLength%20NOT%20IN%20(32%2C12%2C234)%20'
      + `${message.body.link_1_2}%20`
      + `FolderId%20%3D%20%27${message.body.sTerm_2.fieldValue}%27%20`
      + `%20LIMIT%20${message.body.limit}`);
      expectedQuery = expectedQuery.replace(/ /g, '%20');

      const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
        .reply(200, metaModelDocumentReply)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${expectedQuery}`)
        .reply(200, { done: true, totalSize: testReply.results.length, records: testReply.results });

      lookupObjects.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);

      return new Promise((resolve) => {
        testCommon.emitCallback = (what, msg) => {
          if (what === 'data') {
            chai.expect(msg.body).to.deep.equal(testReply);
            scope.done();
            resolve();
          }
        };
      });
    });

    it('Gets Document objects: 2 string search terms, INCLUDES operator, emitAll, limit', () => {
      testCommon.configuration.sobject = 'Document';
      testCommon.configuration.includeDeleted = false;
      testCommon.configuration.outputMethod = 'emitAll';
      testCommon.configuration.termNumber = '2';

      const message = {
        body: {
          limit: 30,
          sTerm_1: {
            fieldName: 'Document Name',
            fieldValue: 'NotVeryImportantDoc,Value_1,Value_2',
            condition: 'INCLUDES',
          },
          link_1_2: 'AND',
          sTerm_2: {
            fieldName: 'Folder ID',
            fieldValue: 'Some folder ID',
            condition: '=',
          },
        },
      };

      const testReply = {
        results: [{
          Id: 'testObjId',
          FolderId: 'xxxyyyzzz',
          Name: 'NotVeryImportantDoc',
          IsPublic: false,
          Body: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
          ContentType: 'imagine/noHeaven',
        },
        {
          Id: 'testObjId',
          FolderId: '123yyyzzz',
          Name: 'VeryImportantDoc',
          IsPublic: true,
          Body: 'wikipedia.org',
          ContentType: 'imagine/noHell',
        },
        ],
      };

      let expectedQuery = testCommon.buildSOQL(metaModelDocumentReply,
        'Name%20INCLUDES%20(%27NotVeryImportantDoc%27%2C%27Value_1%27%2C%27Value_2%27)%20'
      + `${message.body.link_1_2}%20`
      + `FolderId%20%3D%20%27${message.body.sTerm_2.fieldValue}%27%20`
      + `%20LIMIT%20${message.body.limit}`);
      expectedQuery = expectedQuery.replace(/ /g, '%20');

      const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
        .reply(200, metaModelDocumentReply)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${expectedQuery}`)
        .reply(200, { done: true, totalSize: testReply.results.length, records: testReply.results });

      lookupObjects.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);

      return new Promise((resolve) => {
        testCommon.emitCallback = (what, msg) => {
          if (what === 'data') {
            chai.expect(msg.body).to.deep.equal(testReply);
            scope.done();
            resolve();
          }
        };
      });
    });

    it('Gets Document objects: 2 string search terms, EXCLUDES operator, emitAll, limit', () => {
      testCommon.configuration.sobject = 'Document';
      testCommon.configuration.includeDeleted = false;
      testCommon.configuration.outputMethod = 'emitAll';
      testCommon.configuration.termNumber = '2';

      const message = {
        body: {
          limit: 30,
          sTerm_1: {
            fieldName: 'Body Length',
            fieldValue: '32,12,234',
            condition: 'EXCLUDES',
          },
          link_1_2: 'AND',
          sTerm_2: {
            fieldName: 'Folder ID',
            fieldValue: 'Some folder ID',
            condition: '=',
          },
        },
      };

      const testReply = {
        results: [{
          Id: 'testObjId',
          FolderId: 'xxxyyyzzz',
          Name: 'NotVeryImportantDoc',
          IsPublic: false,
          Body: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
          ContentType: 'imagine/noHeaven',
        },
        {
          Id: 'testObjId',
          FolderId: '123yyyzzz',
          Name: 'VeryImportantDoc',
          IsPublic: true,
          Body: 'wikipedia.org',
          ContentType: 'imagine/noHell',
        },
        ],
      };

      let expectedQuery = testCommon.buildSOQL(metaModelDocumentReply,
        'BodyLength%20EXCLUDES%20(32%2C12%2C234)%20'
      + `${message.body.link_1_2}%20`
      + `FolderId%20%3D%20%27${message.body.sTerm_2.fieldValue}%27%20`
      + `%20LIMIT%20${message.body.limit}`);
      expectedQuery = expectedQuery.replace(/ /g, '%20');

      const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
        .reply(200, metaModelDocumentReply)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${expectedQuery}`)
        .reply(200, { done: true, totalSize: testReply.results.length, records: testReply.results });

      lookupObjects.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);

      return new Promise((resolve) => {
        testCommon.emitCallback = (what, msg) => {
          if (what === 'data') {
            chai.expect(msg.body).to.deep.equal(testReply);
            scope.done();
            resolve();
          }
        };
      });
    });

    it('Gets Account objects: 2 numeric search term, emitAll', () => {
      testCommon.configuration.sobject = 'Account';
      testCommon.configuration.includeDeleted = false;
      testCommon.configuration.outputMethod = 'emitAll';
      testCommon.configuration.termNumber = '2';

      const message = {
        body: {
          sTerm_1: {
            fieldName: 'Employees',
            fieldValue: '123',
            condition: '=',
          },
          link_1_2: 'OR',
          sTerm_2: {
            fieldName: 'Employees',
            fieldValue: '1000',
            condition: '>',
          },
        },
      };

      const testReply = {
        results: [{
          Id: 'testObjId',
          FolderId: 'xxxyyyzzz',
          Name: 'NotVeryImportantDoc',
          IsPublic: false,
          Body: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
          ContentType: 'imagine/noHeaven',
        },
        {
          Id: 'testObjId',
          FolderId: '123yyyzzz',
          Name: 'VeryImportantDoc',
          IsPublic: true,
          Body: 'wikipedia.org',
          ContentType: 'imagine/noHell',
        },
        ],
      };

      const expectedQuery = testCommon.buildSOQL(metaModelAccountReply,
        `NumberOfEmployees%20%3D%20${message.body.sTerm_1.fieldValue}%20`
      + `${message.body.link_1_2}%20`
      + `NumberOfEmployees%20%3E%20${message.body.sTerm_2.fieldValue}%20`
      + '%20LIMIT%201000');

      const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Account/describe`)
        .reply(200, metaModelAccountReply)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${expectedQuery}`)
        .reply(200, { done: true, totalSize: testReply.results.length, records: testReply.results });

      lookupObjects.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);
      return new Promise((resolve) => {
        testCommon.emitCallback = (what, msg) => {
          if (what === 'data') {
            chai.expect(msg.body).to.deep.equal(testReply);
            scope.done();
            resolve();
          }
        };
      });
    });

    it('Gets Account objects: 2 numeric search term, emitIndividually, limit = 2', () => {
      testCommon.configuration.sobject = 'Account';
      testCommon.configuration.includeDeleted = false;
      testCommon.configuration.outputMethod = 'emitIndividually';
      testCommon.configuration.termNumber = '2';

      const message = {
        body: {
          limit: 2,
          sTerm_1: {
            fieldName: 'Employees',
            fieldValue: '123',
            condition: '=',
          },
          link_1_2: 'OR',
          sTerm_2: {
            fieldName: 'Employees',
            fieldValue: '1000',
            condition: '>',
          },
        },
      };

      const testReply = {
        results: [{
          Id: 'testObjId',
          FolderId: 'xxxyyyzzz',
          Name: 'NotVeryImportantDoc',
          IsPublic: false,
          Body: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
          ContentType: 'imagine/noHeaven',
        },
        {
          Id: 'testObjId',
          FolderId: '123yyyzzz',
          Name: 'VeryImportantDoc',
          IsPublic: true,
          Body: 'wikipedia.org',
          ContentType: 'imagine/noHell',
        },
        {
          Id: 'tes12jId',
          FolderId: '123sdfyyyzzz',
          Name: 'sdfsdfg',
          IsPublic: true,
          Body: 'dfg.org',
          ContentType: 'imagine/noHell',
        },
        ],
      };

      const expectedQuery = testCommon.buildSOQL(metaModelAccountReply,
        `NumberOfEmployees%20%3D%20${message.body.sTerm_1.fieldValue}%20`
      + `${message.body.link_1_2}%20`
      + `NumberOfEmployees%20%3E%20${message.body.sTerm_2.fieldValue}%20`
      + `%20LIMIT%20${message.body.limit}`);

      const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Account/describe`)
        .reply(200, metaModelAccountReply)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${expectedQuery}`)
        .reply(200, { done: true, totalSize: testReply.results.length, records: testReply.results });

      lookupObjects.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);
      return new Promise((resolve) => {
        testCommon.emitCallback = (what, msg) => {
          if (what === 'data') {
            chai.expect(msg.body).to.deep.equal({ results: [testReply.results.shift()] });
            if (testReply.results.length === 1) {
              scope.done();
              resolve();
            }
          }
        };
      });
    });

    it('Gets Account objects: 2 numeric search term, emitPage, pageNumber = 0, pageSize = 2, includeDeleted', () => {
      testCommon.configuration.sobject = 'Account';
      testCommon.configuration.includeDeleted = true;
      testCommon.configuration.outputMethod = 'emitPage';
      testCommon.configuration.termNumber = '2';

      const message = {
        body: {
          pageNumber: 0,
          pageSize: 2,
          sTerm_1: {
            fieldName: 'Employees',
            fieldValue: '123',
            condition: '=',
          },
          link_1_2: 'OR',
          sTerm_2: {
            fieldName: 'Employees',
            fieldValue: '1000',
            condition: '>',
          },
        },
      };

      const testReply = {
        results: [{
          Id: 'testObjId',
          FolderId: 'xxxyyyzzz',
          Name: 'NotVeryImportantDoc',
          IsPublic: false,
          Body: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
          ContentType: 'imagine/noHeaven',
        },
        {
          Id: 'testObjId',
          FolderId: '123yyyzzz',
          Name: 'VeryImportantDoc',
          IsPublic: true,
          Body: 'wikipedia.org',
          ContentType: 'imagine/noHell',
        },
        {
          Id: 'tes12jId',
          FolderId: '123sdfyyyzzz',
          Name: 'sdfsdfg',
          IsPublic: true,
          Body: 'dfg.org',
          ContentType: 'imagine/noHell',
        },
        {
          Id: 't123es12jId',
          FolderId: '123sdfysdfyyzzz',
          Name: 'sdfsdfg',
          IsPublic: true,
          Body: 'dfg.osdfrg',
          ContentType: 'imagine/nasdoHell',
        },
        {
          Id: 'zzzzzzz',
          FolderId: '123sdfysdfyyzzz',
          Name: 'sdfsdfg',
          IsPublic: true,
          Body: 'dfg.osdfrg',
          ContentType: 'imagine/nasdoHell',
        },
        ],
      };

      const expectedQuery = testCommon.buildSOQL(metaModelAccountReply,
        `NumberOfEmployees%20%3D%20${message.body.sTerm_1.fieldValue}%20`
      + `${message.body.link_1_2}%20`
      + `NumberOfEmployees%20%3E%20${message.body.sTerm_2.fieldValue}%20`
      + `%20LIMIT%20${message.body.pageSize}`);

      const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Account/describe`)
        .reply(200, metaModelAccountReply)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/queryAll?q=${expectedQuery}`)
        .reply(200, { done: true, totalSize: testReply.results.length, records: testReply.results });

      lookupObjects.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);
      return new Promise((resolve) => {
        testCommon.emitCallback = (what, msg) => {
          if (what === 'data') {
            chai.expect(msg.body).to.deep.equal({
              results: [testReply.results[0], testReply.results[1]],
            });
            scope.done();
            resolve();
          }
        };
      });
    });

    it('Gets Account objects: 3 search term, emitPage, pageNumber = 1, pageSize = 2', () => {
      testCommon.configuration.sobject = 'Account';
      testCommon.configuration.includeDeleted = false;
      testCommon.configuration.outputMethod = 'emitPage';
      testCommon.configuration.termNumber = '3';

      const message = {
        body: {
          pageNumber: 1,
          pageSize: 2,
          sTerm_1: {
            fieldName: 'Employees',
            fieldValue: '123',
            condition: '=',
          },
          link_1_2: 'OR',
          sTerm_2: {
            fieldName: 'Employees',
            fieldValue: '1000',
            condition: '>',
          },
          link_2_3: 'AND',
          sTerm_3: {
            fieldName: 'Account Name',
            fieldValue: 'noname',
            condition: 'LIKE',
          },
        },
      };

      const testReply = {
        results: [{
          Id: 'testObjId',
          FolderId: 'xxxyyyzzz',
          Name: 'NotVeryImportantDoc',
          IsPublic: false,
          Body: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg',
          ContentType: 'imagine/noHeaven',
        },
        {
          Id: 'testObjId',
          FolderId: '123yyyzzz',
          Name: 'VeryImportantDoc',
          IsPublic: true,
          Body: 'wikipedia.org',
          ContentType: 'imagine/noHell',
        },
        {
          Id: 'tes12jId',
          FolderId: '123sdfyyyzzz',
          Name: 'sdfsdfg',
          IsPublic: true,
          Body: 'dfg.org',
          ContentType: 'imagine/noHell',
        },
        {
          Id: 't123es12jId',
          FolderId: '123sdfysdfyyzzz',
          Name: 'sdfsdfg',
          IsPublic: true,
          Body: 'dfg.osdfrg',
          ContentType: 'imagine/nasdoHell',
        },
        {
          Id: 'zzzzzzz',
          FolderId: '123sdfysdfyyzzz',
          Name: 'sdfsdfg',
          IsPublic: true,
          Body: 'dfg.osdfrg',
          ContentType: 'imagine/nasdoHell',
        },
        ],
      };

      const expectedQuery = testCommon.buildSOQL(metaModelAccountReply,
        `NumberOfEmployees%20%3D%20${message.body.sTerm_1.fieldValue}%20`
      + `${message.body.link_1_2}%20`
      + `NumberOfEmployees%20%3E%20${message.body.sTerm_2.fieldValue}%20`
      + `${message.body.link_2_3}%20`
      + `Name%20LIKE%20%27${message.body.sTerm_3.fieldValue}%27%20`
      + `%20LIMIT%20${message.body.pageSize}`
      + `%20OFFSET%20${message.body.pageSize}`);

      const scope = nock(testCommon.instanceUrl, { encodedQueryParams: true })
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Account/describe`)
        .reply(200, metaModelAccountReply)
        .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${expectedQuery}`)
        .reply(200, { done: true, totalSize: testReply.results.length, records: testReply.results });

      lookupObjects.process.call(testCommon, _.cloneDeep(message), testCommon.configuration);
      return new Promise((resolve) => {
        testCommon.emitCallback = (what, msg) => {
          if (what === 'data') {
            chai.expect(msg.body).to.deep.equal({
              results: [testReply.results[0], testReply.results[1]],
            });
            scope.done();
            resolve();
          }
        };
      });
    });
  });
});
