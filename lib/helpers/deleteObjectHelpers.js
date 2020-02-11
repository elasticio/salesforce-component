const { messages } = require('elasticio-node');/**
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

  } catch (error) {
    const err = new Error(`Salesforce error. ${error.message}`);
    this.logger.error(err);
    this.emit('error', err);
  }
}