"use strict"

const chai = require("chai");
const nock = require("nock");

const common = require("../../lib/common.js");
const testCommon = require("../common.js");

const queryObjects = require("../../lib/actions/query.js");

// Disable real HTTP requests
nock.disableNetConnect();

describe("Query module: processAction", () => {

  it(`Gets objects not including deleted`, () => {

    testCommon.configuration.includeDeleted = false;
    testCommon.configuration.allowResultAsSet = true;

    const message = {
      body: {
        query: "select name, id from account where name = 'testtest'"
      }
    };

    const testReply = {
      result: [
        {
          Id: "testObjId",
          FolderId: "xxxyyyzzz",
          Name: "NotVeryImportantDoc",
          IsPublic: false,
          Body: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg",
          ContentType: "imagine/noHeaven"
        },
        {
          Id: "testObjId",
          FolderId: "123yyyzzz",
          Name: "VeryImportantDoc",
          IsPublic: true,
          Body: "wikipedia.org",
          ContentType: "imagine/noHell"
        }
      ]
    };

    const expectedQuery = "select%20name%2C%20id%20from%20account%20where%20name%20%3D%20%27testtest%27";

    const scope = nock(testCommon.configuration.oauth.instance_url, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/query?q=${expectedQuery}`)
      .reply(200, { done: true, totalSize: testReply.result.length, records: testReply.result });
    
    queryObjects.process.call(testCommon, message, testCommon.configuration);
    return new Promise(resolve => {
      testCommon.emitCallback = function(what, msg) {
        if (what === 'data') { 
          chai.expect(msg.body).to.deep.equal(testReply);
          scope.done();
          resolve();
        }
      };
    });
  });

  it(`Gets objects including deleted`, () => {

    testCommon.configuration.includeDeleted = true;
    testCommon.configuration.allowResultAsSet = true;

    const message = {
      body: {
        query: "select name, id from account where name = 'testtest'"
      }
    };

    const testReply = {
      result: [
        {
          Id: "testObjId",
          FolderId: "xxxyyyzzz",
          Name: "NotVeryImportantDoc",
          IsPublic: false,
          Body: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Everest_kalapatthar.jpg/800px-Everest_kalapatthar.jpg",
          ContentType: "imagine/noHeaven"
        },
        {
          Id: "testObjId",
          FolderId: "123yyyzzz",
          Name: "VeryImportantDoc",
          IsPublic: true,
          Body: "wikipedia.org",
          ContentType: "imagine/noHell"
        }
      ]
    };

    const expectedQuery = "select%20name%2C%20id%20from%20account%20where%20name%20%3D%20%27testtest%27";

    const scope = nock(testCommon.configuration.oauth.instance_url, { encodedQueryParams: true })
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/queryAll?q=${expectedQuery}`)
      .reply(200, { done: true, totalSize: testReply.result.length, records: testReply.result });
    
    queryObjects.process.call(testCommon, message, testCommon.configuration);
    return new Promise(resolve => {
      testCommon.emitCallback = function(what, msg) {
        if (what === 'data') { 
          chai.expect(msg.body).to.deep.equal(testReply);
          scope.done();
          resolve();
        }
      };
    });
  });

});