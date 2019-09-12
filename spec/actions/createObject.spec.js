"use strict"

const chai = require("chai");
const nock = require("nock");

const common = require("../../lib/common.js");
const testCommon = require("../common.js");
const testData = require("./createObject.json");
const createObject = require("../../lib/actions/createObject.js");

describe("Create Object module: objectTypes", () => {

  it(`Retrieves the list of createable sobjects`, async () => {

    nock(testCommon.configuration.oauth.instance_url)
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects`)
      .reply(200, testData.objectTypesReply);
      
    const expectedResult = {};
    testData.objectTypesReply.sobjects.forEach((object) => {
      if (object.createable)
        expectedResult[object.name] = object.label;
    });

    const result = await createObject.objectTypes(testCommon.configuration);
    chai.expect(result).to.deep.equal(expectedResult);
  });
});

describe("Create Object module: getMetaModel", () => {

  it(`Retrieves metadata for Document object`, () => {

    nock(testCommon.configuration.oauth.instance_url)
      .get(`/services/data/v${common.globalConsts.SALESFORCE_API_VERSION}/sobjects/Document/describe`)
      .reply(200, testData.getMetaModelDocumentReply);

    nock(testCommon.refresh_token.url)
      .post('')
      .reply(200, testCommon.refresh_token.response);
      
    const expectedResult = {};
    testData.getMetaModelDocumentReply.fields.forEach((object) => {
      if (object.createable)
        expectedResult[object.name] = object.label;
    });

    return new Promise(function(resolve, reject) {
      testCommon.configuration.sobject = "Document";
      createObject.getMetaModel.call(testCommon, testCommon.configuration, function getResult(err, data) {
        if (err)
          reject(err);

        resolve(data);
      });
    }).then(function(data) {
      chai.expect(data).to.deep.equal(expectedResult);
    });    
  });
});
