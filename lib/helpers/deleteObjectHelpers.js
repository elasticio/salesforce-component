const { messages } = require('elasticio-node');
const createObj = require('../../lib/actions/createObject.js');
const deleteObjectData = require('../../spec-integration/actions/deleteObject.json');

/**
 * Des: 
 * - This function will use the active sf connection to delete an obj by Id
 * - Implemented in a try catch block and will emit the salesforce error if
 * it exists 
 * @implementedBy C.J.V
 * @param sfConn an open salesforce connection
 * @param id the id of the obj to delete
 * @param objType the obj type to delete
*/
module.exports.deleteObjById = async function deleteObjById(sfConn, id, objType) {
  try {
    this.logger.info(`Here's the ID of what we're deleting ${id}`);
    this.logger.info( `Note if the object has a master-detail relationship 
                      with another object it will also be deleted `);
    let res = await sfConn.sobject(objType).delete(id);

    this.logger.info(`Sucessfully deleted object ${id}`);
    const outputMessage = messages.newMessageWithBody(res);
    this.emit('data', outputMessage);

  } catch (err) {
    this.logger.error(err.message);
    this.emit('error', err.message);
  }
}

/**
 * Des: 
 * - This function will connect to salesforce and create all the test data needed for
 * the integration tests based on the test JSON file
 * - The test data will also include raw config data required to make API calls
 * - Reads from the JSON file to understand required fields
 * - Will yield the next test case
 * @implementedBy C.J.V
 * @returns list of all test data
*/
module.exports.testDataFactory = async function testDataFactory() {

  let usesId;
  const testObjLst = []; 
  for ( let i = 0; i < deleteObjectData.cases.length; i++ ) {

      let currCaseObj = deleteObjectData.cases[i];      
      usesId = false;

      currCaseObj.config.oauth.refresh_token = process.env.REFRESH_TOKEN;
      currCaseObj.config.oauth.access_token = process.env.ACCESS_TOKEN;

      // if the create field includes an Id remove it as its populated by sf
      if (currCaseObj.message.body.Id) {
        delete currCaseObj.message.body.Id;
        usesId = true;
      }

      // has format of { id: "", success: bool }
      await createObj.process.call(this, currCaseObj.message, currCaseObj.config);

      if (this.emit.args[0][0] === 'error') {
        return false;
      }

      // specify the deletion object's ID if required for the case
      if ( usesId ) {
        currCaseObj.message.body.Id = spy.args.body.id;
      }

      // if there's a response then populate the ID dynamically
      if ( currCaseObj.response ) {
        currCaseObj.response.id = spy.args.body.id;
      }

      testObjLst.append(currCaseObj);
  }
  return testObjLst
}