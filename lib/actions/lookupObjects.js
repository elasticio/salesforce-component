const { messages } = require('elasticio-node');
const MetaLoader = require('../helpers/metaLoader.js');
const sfConnection = require('../helpers/sfConnection.js');

const DEFAULT_PAGE_NUM = 0;
const DEFAULT_LIMIT_EMITSINGLE = 10000;
const DEFAULT_LIMIT_EMITALL = 1000;
const DEFAULT_TERM_NUMBER = 0;
const TERM_MAX_NUMBER = 42;

const LOGICAL_OPERATORS = ['AND', 'OR'];
const COMPARISON_OPERATORS = ['=', '!=', '<', '<=', '>', '>=', 'LIKE', 'IN', 'NOT IN'];

function toNumberInInterval(num, min, max, defaultValue) {
  num = parseInt(num, 10);

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

module.exports.objectTypes = function getObjectTypes(configuration) {
  const metaLoader = new MetaLoader(configuration, this);
  return metaLoader.getSearchableObjectTypes();
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

  const metaLoader = new MetaLoader(configuration, this);
  const objectFieldsMetaData = await metaLoader.getObjectFieldsMetaData();

  const filterableFields = [];
  objectFieldsMetaData.forEach((field) => {
    if (!field.deprecatedAndHidden) {
      if (field.filterable && field.type !== 'address' && field.type !== 'location') { // Filter out compound fields
        filterableFields.push(field.label);
      }

      result.out.properties.results.properties[field.name] = metaLoader.createProperty(field);
    }
  });

  configuration.termNumber = toNumberInInterval(configuration.termNumber, 0, TERM_MAX_NUMBER, DEFAULT_TERM_NUMBER);

  for (let i = 1; i <= configuration.termNumber; i += 1) {
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

    if (i !== configuration.termNumber) {
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

async function getWherePart(message, configuration, sfConn) {
  let wherePart = '';

  if (configuration.termNumber === 0) {
    return wherePart;
  }

  const metaLoader = new MetaLoader(configuration, this, sfConn);
  const objMetaData = await metaLoader.ObjectMetaData();

  for (let i = 1; i <= configuration.termNumber; i += 1) {
    const sTerm = message.body[`sTerm_${i}`];
    const field = objMetaData.findFieldByLabel(sTerm.fieldName);

    wherePart += `${field.name} ${sTerm.condition} `;

    if (objMetaData.isStringField(field)) {
      wherePart += `'${sTerm.fieldValue}' `;
    } else {
      wherePart += `${sTerm.fieldValue} `;
    }

    if (i != configuration.termNumber) {
      wherePart += `${message.body[`link_${i}_${i + 1}`]} `;
    }
  }

  return wherePart;
}

module.exports.process = async function processAction(message, configuration) {
  this.logger.info(`Preparing to query ${configuration.sobject} objects...`);

  const sfConn = sfConnection.createConnection(configuration, this);

  this.logger.info('Building a query...');

  const wherePart = await getWherePart(message, configuration, sfConn);
  this.logger.debug('Where part: ', wherePart);

  let limit;
  let offset;

  switch (configuration.outputMethod) {
    case 'emitPage':
      limit = toNumberInInterval(message.body.pageSize, 1, null, DEFAULT_LIMIT_EMITALL);
      message.body.pageNumber = toNumberInInterval(message.body.pageNumber, 0, null, DEFAULT_PAGE_NUM);
      offset = limit * message.body.pageNumber;
      break;

    case 'emitIndividually':
      limit = toNumberInInterval(message.body.limit, 1, null, DEFAULT_LIMIT_EMITSINGLE);
      break;

    case 'emitAll':
      limit = toNumberInInterval(message.body.limit, 1, null, DEFAULT_LIMIT_EMITALL);
      break;

    default:
  }

  const records = [];

  const query = sfConn.sobject(configuration.sobject)
    .select('*')
    .where(wherePart)
    .offset(offset)
    .limit(limit)
    .scanAll(configuration.includeDeleted)
    .on('error', (err) => {
      this.logger.error(err);
      this.emit('error', err);
    });

  if (configuration.outputMethod === 'emitIndividually') {
    query.on('record', (record) => {
      this.emit('data', messages.newMessageWithBody({ results: [record] }));
    })
      .on('end', () => {
        if (!query.totalFetched) {
          this.emit('data', messages.newMessageWithBody({ results: [] }));
        }

        this.logger.info(`Got ${query.totalFetched} records`);
      });
  } else {
    query.on('record', (record) => {
      records.push(record);
    })
      .on('end', () => {
        this.emit('data', messages.newMessageWithBody({ results: records }));
        this.logger.info(`Got ${query.totalFetched} records`);
      });
  }

  this.logger.info('Sending the request to SalesForce...');
  return query.execute({ autoFetch: true, maxFetch: limit });
};
