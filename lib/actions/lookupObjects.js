"use strict";

const { messages } = require('elasticio-node');
const MetaLoader = require('../helpers/metaLoader.js');
const sfConnection = require('../helpers/sfConnection.js');
const debug = require('debug')('salesforce:lookupObjects');

const DEFAULT_PAGE_NUM = 0;
const DEFAULT_LIMIT_EMITSINGLE = 10000;
const DEFAULT_LIMIT_EMITALL = 1000;
const TERM_MAX_NUMBER = 42;

const LOGICAL_OPERATORS = ["AND", "OR"];
const COMPARISON_OPERATORS = ["=", "!=", "<", "<=", ">", ">=", "LIKE", "IN", "NOT IN"];

function isNumberInInterval(num, min, max)
{
  if (isNaN(num))
    return false;

  if (!isNaN(min) && num < min)
    return false;

  if (!isNaN(max) && num > max)
    return false;

  return true;
}

module.exports.objectTypes = function getObjectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getSearchableObjectTypes();
};

module.exports.getMetaModel = async function getMetaModel(configuration) {
  
  const result = {
    in: {
      type: "object",
      properties: {}
    },
    out: {
      type: "object",
      properties: {
        results: {
          type: "array",
          required: true,
          properties: {}
        }
      }
    }
  };

  if (configuration.outputMethod === "emitPage") {
    result.in.properties.pageSize = {
      title: "Page size",
      type: "number",
      required: false
    };
    result.in.properties.pageNumber = {
      title: "Page number",
      type: "number",
      required: true
    };
  } else {
    result.in.properties.limit = {
      title: "Maximum number of records",
      type: "number",
      required: false
    };
  }

  const metaLoader = new MetaLoader(configuration, this);
  const objectFieldsMetaData = await metaLoader.getObjectFieldsMetaData();

  const filterableFields = [];
  objectFieldsMetaData.forEach(field => {
    if (!field.deprecatedAndHidden) {
      if (field.filterable && field.type !== "address" && field.type !== "location") // Filter out compound fields
        filterableFields.push(field.label);

      result.out.properties.results.properties[field.name] = metaLoader.createProperty(field);
    }
  });

  if (!isNumberInInterval(configuration.termNumber, 0, TERM_MAX_NUMBER))
    configuration.termNumber = 0;

  for (let i = 1; i <= configuration.termNumber; ++i) {
    result.in.properties[`sTerm_${i}`] = {
      title: `Search term ${i}`,
      type: "object",
      required: true,
      properties: {
        fieldName: {
          title: "Field name",
          type: "string",
          required: true,
          enum: filterableFields
        },
        fieldValue: {
          title: "Field value",
          type: "string",
          required: true
        },
        condition: {
          title: "Condition",
          type: "string",
          required: true,
          enum: COMPARISON_OPERATORS
        }
      }
    };

    if (i != configuration.termNumber) {
      result.in.properties[`link_${i}_${i+1}`] = {
        title: "Logical operator",
        type: "string",
        required: true,
        enum: LOGICAL_OPERATORS
      }
    }
  }

  return result;
}

async function getWherePart(message, configuration, sfConn) {

  let wherePart = "";

  if (configuration.termNumber === 0)
    return wherePart;

  const metaLoader = new MetaLoader(configuration, this, sfConn);
  const objMetaData = await metaLoader.ObjectMetaData();

  for (let i = 1; i <= configuration.termNumber; ++i) {
    const sTerm = message.body[`sTerm_${i}`];
    const field = objMetaData.findFieldByLabel(sTerm.fieldName);

    wherePart += `${field.name} ${sTerm.condition} `;
    
    if (objMetaData.isStringField(field))
      wherePart += `'${sTerm.fieldValue}' `;
    else
      wherePart += `${sTerm.fieldValue} `;

    if (i != configuration.termNumber)
      wherePart += `${message.body[`link_${i}_${i+1}`]} `;
  }

  return wherePart;
}

module.exports.process = async function processAction(message, configuration) {
  console.log(`Preparing to query ${configuration.sobject} objects...`);

  const sfConn = sfConnection.createConnection(configuration, this);

  console.log(`Building a query...`);

  const wherePart = await getWherePart(message, configuration, sfConn);
  debug("Where part: ", wherePart);

  let limit;
  let offset;

  switch (configuration.outputMethod) {
    case "emitPage":
      if (!isNumberInInterval(message.body.pageSize, 1))
        message.body.pageSize = DEFAULT_LIMIT_EMITALL;
      
      if (!isNumberInInterval(message.body.pageNumber, 0))
        message.body.pageNumber = DEFAULT_PAGE_NUM;
  
      limit = message.body.pageSize;
      offset = message.body.pageSize * message.body.pageNumber;
      break;

    case "emitIndividually":
      limit = message.body.limit;
      if (!isNumberInInterval(limit, 1))
        limit = DEFAULT_LIMIT_EMITSINGLE;
      break;

    case "emitAll":
      limit = message.body.limit;
      if (!isNumberInInterval(limit, 1))
        limit = DEFAULT_LIMIT_EMITALL;
      break;
  };

  const records = [];

  const query = sfConn.sobject(configuration.sobject)
  .select("*")
  .where(wherePart)
  .offset(offset)
  .limit(limit)
  .scanAll(configuration.includeDeleted)
  .on("error", err => {
    console.error(err);
    this.emit('error', err);
  });

  if (configuration.outputMethod === "emitIndividually") {
    query.on("record", record => {
      this.emit('data', messages.newMessageWithBody([record]));
    })
    .on("end", () => {
      if (!query.totalFetched)
        this.emit('data', messages.newMessageWithBody([]));

      console.log(`Got ${query.totalFetched} records`);
    });
  } else {
    query.on("record", record => {
      records.push(record);
    })
    .on("end", () => {
      this.emit('data', messages.newMessageWithBody(records));
      console.log(`Got ${query.totalFetched} records`);
    });
  }

  //debug("SOQL: ", await query.toSOQL());

  console.log("Sending the request to SalesForce...");
  return query.execute({ autoFetch: true, maxFetch: limit });
}