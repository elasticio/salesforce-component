/* eslint-disable no-await-in-loop */
const { messages } = require('elasticio-node');
const { lookupCache } = require('../helpers/lookupCache.js');
const { callJSForceMethod } = require('../helpers/wrapper');
const { createProperty } = require('../helpers/utils');

const DEFAULT_PAGE_NUM = 0;
const DEFAULT_LIMIT_EMITSINGLE = 10000;
const DEFAULT_LIMIT_EMITALL = 1000;
const TERM_MAX_NUMBER = 99;

const LOGICAL_OPERATORS = ['AND', 'OR'];
const COMPARISON_OPERATORS_LIST = ['IN', 'NOT IN', 'INCLUDES', 'EXCLUDES'];
const COMPARISON_OPERATORS = ['=', '!=', '<', '<=', '>', '>=', 'LIKE'].concat(COMPARISON_OPERATORS_LIST);

function toNumberInInterval(strNum, min, max, defaultValue) {
  const num = parseInt(strNum, 10);

  if (Number.isNaN(num)) {
    return defaultValue;
  }

  if (Number.isInteger(min) && num < min) {
    return defaultValue;
  }

  if (Number.isInteger(max) && num > max) {
    return defaultValue;
  }

  return num;
}

function isNumberInInterval(num, min, max) {
  return !(Number.isNaN(num) || num < min || num > max);
}

module.exports.objectTypes = async function getObjectTypes(configuration) {
  return callJSForceMethod.call(this, configuration, 'getSearchableObjectTypes');
};

module.exports.getMetaModel = async function getMetaModel(configuration) {
  const result = {
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
    result.in.properties.pageSize = {
      title: 'Page size',
      type: 'number',
      required: false,
    };
    result.in.properties.pageNumber = {
      title: 'Page number',
      type: 'number',
      required: true,
    };
  } else {
    result.in.properties.limit = {
      title: 'Maximum number of records',
      type: 'number',
      required: false,
    };
  }

  const objectFieldsMetaData = await callJSForceMethod.call(this, configuration, 'getObjectFieldsMetaData');

  const filterableFields = [];
  objectFieldsMetaData.forEach((field) => {
    if (!field.deprecatedAndHidden) {
      if (field.filterable && field.type !== 'address' && field.type !== 'location') { // Filter out compound fields
        filterableFields.push(field.label);
      }
      result.out.properties.results.properties[field.name] = createProperty(field);
    }
  });

  filterableFields.sort();

  const termNumber = parseInt(configuration.termNumber, 10);
  if (!isNumberInInterval(termNumber, 0, TERM_MAX_NUMBER)) {
    throw new Error('Number of search terms must be an integer value from the interval [0-99]');
  }

  for (let i = 1; i <= termNumber; i += 1) {
    result.in.properties[`sTerm_${i}`] = {
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

    if (i !== termNumber) {
      result.in.properties[`link_${i}_${i + 1}`] = {
        title: 'Logical operator',
        type: 'string',
        required: true,
        enum: LOGICAL_OPERATORS,
      };
    }
  }

  return result;
};

async function getWherePart(message, configuration) {
  let wherePart = '';

  const termNumber = parseInt(configuration.termNumber, 10);

  if (termNumber === 0) {
    return wherePart;
  }

  const objMetaData = await callJSForceMethod.call(this, configuration, 'objectMetaData');

  for (let i = 1; i <= termNumber; i += 1) {
    const sTerm = message.body[`sTerm_${i}`];
    const field = objMetaData.findFieldByLabel(sTerm.fieldName);

    wherePart += `${field.name} ${sTerm.condition} `;

    if (COMPARISON_OPERATORS_LIST.includes(sTerm.condition)) {
      wherePart += '(';
      // eslint-disable-next-line no-loop-func
      sTerm.fieldValue.split(',').forEach((value) => {
        if (wherePart.charAt(wherePart.length - 1) !== '(') {
          wherePart += ',';
        }

        if (objMetaData.isStringField(field)) {
          wherePart += `'${value}'`;
        } else {
          wherePart += value;
        }
      });
      wherePart += ') ';
    } else if (objMetaData.isStringField(field)) {
      wherePart += `'${sTerm.fieldValue}' `;
    } else {
      wherePart += `${sTerm.fieldValue} `;
    }

    if (i !== termNumber) {
      wherePart += `${message.body[`link_${i}_${i + 1}`]} `;
    }
  }

  return wherePart;
}

module.exports.process = async function processAction(message, configuration) {
  const limitEmitsingle = configuration.maxFetch || DEFAULT_LIMIT_EMITSINGLE;
  const limitEmitall = configuration.maxFetch || DEFAULT_LIMIT_EMITALL;

  this.logger.info(`Preparing to query ${configuration.sobject} objects...`);
  this.logger.info('Building a wherePart...');
  const wherePart = await getWherePart.call(this, message, configuration);
  this.logger.trace('Where part: ', wherePart);

  let limit;
  let offset;

  switch (configuration.outputMethod) {
    case 'emitPage':
      limit = toNumberInInterval(message.body.pageSize, 1, null, limitEmitall);
      // eslint-disable-next-line no-param-reassign
      message.body
        .pageNumber = toNumberInInterval(message.body.pageNumber, 0, null, DEFAULT_PAGE_NUM);
      offset = limit * message.body.pageNumber;
      break;

    case 'emitIndividually':
      limit = toNumberInInterval(message.body.limit, 1, null, limitEmitsingle);
      break;

    case 'emitAll':
      limit = toNumberInInterval(message.body.limit, 1, null, limitEmitall);
      break;

    default:
  }

  let records;
  lookupCache.useCache(configuration.enableCacheUsage);
  const queryKey = lookupCache.generateKeyFromDataArray(configuration.sobject, wherePart,
    offset, limit, configuration.includeDeleted);
  this.logger.trace(`Current request key hash: "${queryKey}"`);
  if (lookupCache.hasKey(queryKey)) {
    this.logger.info('Cached response found!');
    records = lookupCache.getResponse(queryKey);
  } else {
    const queryOptions = { wherePart, offset, limit };
    records = await callJSForceMethod.call(this, configuration, 'lookupQuery', queryOptions);
    if (records.length > 0) {
      lookupCache.addRequestResponsePair(queryKey, records);
    }
  }
  this.logger.info(`Got ${records.length} records`);
  if (configuration.outputMethod === 'emitIndividually') {
    if (records.length === 0) {
      await this.emit('data', messages.newMessageWithBody({ results: [] }));
    } else {
      for (let i = 0; i < records.length; i += 1) {
        await this.emit('data', messages.newMessageWithBody({ results: [records[i]] }));
      }
    }
  } else {
    await this.emit('data', messages.newMessageWithBody({ results: records }));
  }
};
