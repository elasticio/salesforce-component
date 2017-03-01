'use strict';
const jsforce = require('jsforce');

/**
 * See list on https://na45.salesforce.com/services/data/
 * @type {string}
 */
const SALESFORCE_API_VERSION = '39.0';

const TYPES_MAP = {
    id: 'string',
    boolean: 'boolean',
    string: 'string',
    double: 'float',
    textarea: 'string',
    reference: 'string',
    phone: 'string',
    date: 'date',
    datetime: 'date',
    picklist: 'string',
    email: 'string',
    address: 'address',
    url: 'string'
};

/**
 * This method returns a property description for e.io proprietary schema
 *
 * @param field
 */
function createProperty(field) {
    const result = {};
    result.type = TYPES_MAP[field.type];
    if (!result.type) {
        throw new Error(`Can't convert type for type=${field.type} field=${JSON.stringify(field, null, ' ')}`);
    }
    if (field.type === 'textarea') {
        result.maxLength = 1000;
    } else if (field.type === 'picklist') {
        result.enum = field.picklistValues.filter((p) => p.active).map((p) => p.value);
    } else if (field.type === 'address') {
        result.type = 'object';
        result.properties = {
            city: {type: 'string'},
            country: {type: 'string'},
            postalCode: {type: 'string'},
            state: {type: 'string'},
            street: {type: 'string'}
        };
    }
    result.required = !field.nillable;
    return result;
}

/**
 * This function will be called to fetch available object types.
 *
 * Note: only updatable and creatable object types are returned here
 *
 * @param cfg
 */
function getObjectTypes(cfg) {
    console.log('Connecting to Salesforce');
    const conn = new jsforce.Connection({
        oauth2: {
            clientId: process.env.SALESFORCE_KEY,
            clientSecret: process.env.SALESFORCE_SECRET,
            redirectUri: 'https://app.elastic.io/oauth/v2'
        },
        instanceUrl: cfg.oauth.instance_url,
        accessToken: cfg.oauth.access_token,
        refreshToken: cfg.oauth.refresh_token,
        version: SALESFORCE_API_VERSION
    });
    conn.on('refresh', (accessToken, res) => {
        console.log('Keys were updated, res=%j', res);
        this.emit('updateKeys', {oauth: res});
    });
    conn.on('error', err => this.emit('error', err));
    console.log('Fetching sobjects list');
    return conn.describeGlobal().then((response) => {
        const result = {};
        response.sobjects.filter((object) => object.updateable && object.createable).forEach((object) => {
            result[object.name] = object.label;
        });
        console.log('Found %s objects', Object.keys(result).length);
        return result;
    });
}

/**
 * This function will return a metamodel description for a particular object
 *
 * @param cfg
 */
function getMetaModel(cfg) {
    console.log('Connecting to Salesforce');
    const conn = new jsforce.Connection({
        oauth2: {
            clientId: process.env.SALESFORCE_KEY,
            clientSecret: process.env.SALESFORCE_SECRET,
            redirectUri: 'https://app.elastic.io/oauth/v2'
        },
        instanceUrl: cfg.oauth.instance_url,
        accessToken: cfg.oauth.access_token,
        refreshToken: cfg.oauth.refresh_token,
        version: SALESFORCE_API_VERSION
    });
    conn.on('refresh', (accessToken, res) => {
        console.log('Keys were updated, res=%j', res);
        this.emit('updateKeys', {oauth: res});
    });
    console.log('Fetching description for sobject=%s', cfg.sobject);
    return conn.describe(cfg.sobject).then((meta) => {
        const result = {
            in: {
                type: 'object'
            },
            out: {
                type: 'object'
            }
        };
        const inProp = result.in.properties = {};
        const outProp = result.out.properties = {};
        meta.fields.filter((field) => !field.deprecatedAndHidden).forEach((field) => {
            try {
                if (field.createable) {
                    inProp[field.name] = createProperty(field);
                }
                outProp[field.name] = createProperty(field);
            } catch (err) {
                console.log(err.stack);
            }
        });
        return result;
    });
}

/**
 * This function will upsert given object
 *
 * @param msg
 * @param cfg
 */
function upsertObject(msg, cfg) {
    console.log('Starting upsertObject');
    const conn = new jsforce.Connection({
        oauth2: {
            clientId: process.env.SALESFORCE_KEY,
            clientSecret: process.env.SALESFORCE_SECRET,
            redirectUri: 'https://app.elastic.io/oauth/v2'
        },
        instanceUrl: cfg.oauth.instance_url,
        accessToken: cfg.oauth.access_token,
        refreshToken: cfg.oauth.refresh_token,
        version: SALESFORCE_API_VERSION
    });
    conn.on('refresh', (accessToken, res) => {
        console.log('Keys were updated, res=%j', res);
        this.emit('updateKeys', {oauth: res});
    });
    return conn.sobject(cfg.sobject).upsert(msg.body, cfg.extIdField);
}

module.exports.process = upsertObject;
module.exports.getMetaModel = getMetaModel;
module.exports.objectTypes = getObjectTypes;