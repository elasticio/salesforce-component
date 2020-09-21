/* eslint-disable no-param-reassign,no-await-in-loop */
const elasticio = require('elasticio-node');

const { messages } = elasticio;
const { callJSForceMethod } = require('./helpers/wrapper');
const { getLinkedObjectTypes, processMeta } = require('./helpers/utils');

module.exports.objectTypes = async function getObjectTypes(configuration) {
  return callJSForceMethod.call(this, configuration, 'getObjectTypes');
};

module.exports.linkedObjectTypes = async function linkedObjectTypes(configuration) {
  const meta = await callJSForceMethod.call(this, configuration, 'describe');
  return getLinkedObjectTypes(meta);
};

module.exports.getMetaModel = async function getMetaModel(configuration) {
  const meta = await callJSForceMethod.call(this, configuration, 'describe');
  return processMeta(meta, 'polling');
};

module.exports.process = async function process(message, configuration, snapshot) {
  this.logger.info('Starting Get New and Updated Objects Polling trigger');
  if (!snapshot || (typeof (snapshot) === 'object' && !snapshot.previousLastModified)) {
    snapshot = {
      previousLastModified: configuration.startTime || '1970-01-01T00:00:00.000Z',
    };
    this.logger.trace('Created snapshot: %j', snapshot);
  } else if (typeof snapshot === 'string') {
    // for backward compatibility
    snapshot = { previousLastModified: snapshot };
    this.logger.trace('Snapshot has been converted to: %j', snapshot);
  } else {
    this.logger.trace('Got snapshot: %j', snapshot);
  }

  configuration.sobject = configuration.object;
  const { linkedObjects = [] } = configuration;
  const singlePagePerInterval = (configuration.singlePagePerInterval !== 'no');
  const maxTime = configuration.endTime ? ` AND LastModifiedDate <= ${configuration.endTime}` : '';
  let hasMorePages = true;
  let lastSeenTime = snapshot.previousLastModified;
  let maxFetch = configuration.maxFetch ? configuration.parseInt(configuration.maxFetch, 10) : 1000;

  if (configuration.sizeOfPollingPage) {
    this.logger.debug('Current sizeOfPollingPage=%s, maxFetch=%s', configuration.sizeOfPollingPage, maxFetch);
    const sizeOfPollingPage = parseInt(configuration.sizeOfPollingPage, 10);
    if (sizeOfPollingPage && sizeOfPollingPage > 0 && sizeOfPollingPage <= 10000) {
      maxFetch = sizeOfPollingPage;
    } else {
      throw new Error('Size of Polling Page needs to be positive integer, max 10000 objects');
    }
  }

  // the query for the object and all its linked parent objects
  const selectedObjects = linkedObjects.reduce((query, obj) => {
    if (!obj.startsWith('!')) return `${query}, ${obj}.*`;
    return query;
  }, '*');
  const queryOptions = { selectedObjects, linkedObjects, maxFetch };
  do {
    let whereCondition;
    // eslint-disable-next-line max-len
    if (lastSeenTime === configuration.startTime || lastSeenTime === '1970-01-01T00:00:00.000Z') whereCondition = `LastModifiedDate >= ${lastSeenTime}${maxTime}`;
    else whereCondition = `LastModifiedDate > ${lastSeenTime}${maxTime}`;
    try {
      queryOptions.whereCondition = whereCondition;
      const records = await callJSForceMethod.call(this, configuration, 'pollingSelectQuery', queryOptions);
      if (!records || !records.length) {
        this.logger.info('No new objects found');
        hasMorePages = false;
      } else {
        const { outputMethod = 'emitIndividually' } = configuration;
        if (outputMethod === 'emitAll') {
          await this.emit('data', messages.newMessageWithBody({ records }));
        } else if (outputMethod === 'emitIndividually') {
          for (let i = 0; i < records.length; i += 1) {
            const newMsg = messages.newEmptyMessage();
            newMsg.headers = {
              objectId: records[i].attributes.url,
            };
            newMsg.body = records[i];
            this.logger.debug('emitting record %d', i);
            await this.emit('data', newMsg);
          }
        } else {
          throw new Error('Unsupported Output method');
        }
        hasMorePages = records.length === maxFetch;
        lastSeenTime = records[records.length - 1].LastModifiedDate;
      }
    } catch (err) {
      this.logger.error('Error occurred during polling objects');
      throw err;
    }
    if (singlePagePerInterval) {
      hasMorePages = false;
    }
  } while (hasMorePages);

  if (snapshot.previousLastModified !== lastSeenTime) {
    snapshot.previousLastModified = lastSeenTime;
    this.logger.trace('emitting new snapshot: %j', snapshot);
    await this.emit('snapshot', snapshot);
  }
  await this.emit('end');
};
