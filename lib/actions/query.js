const util = require('util');
const vm = require('vm');
const jsforce = require('jsforce');
const messages = require('elasticio-node').messages;

/**
 * See list on https://na45.salesforce.com/services/data/
 * @type {string}
 */
const SALESFORCE_API_VERSION = '39.0';

exports.process = function processAction(msg, conf) {
    console.log('Starting SOQL Select query=%s', msg.body.query);
    const conn = new jsforce.Connection({
        oauth2: {
            clientId: process.env.SALESFORCE_KEY,
            clientSecret: process.env.SALESFORCE_SECRET,
            redirectUri: 'https://app.elastic.io/oauth/v2'
        },
        instanceUrl: conf.oauth.instance_url,
        accessToken: conf.oauth.access_token,
        refreshToken: conf.oauth.refresh_token,
        version: SALESFORCE_API_VERSION
    });
    conn.on('refresh', (accessToken, res) => {
        console.log('Keys were updated, res=%j', res);
        this.emit('updateKeys', {oauth: res});
    });
    const result = conn.query(msg.body.query)
        .on("record", (record) => {
            this.emit('data', messages.newMessageWithBody(record));
        })
        .on("end", () => {
            console.log("total in database=%s", result.totalSize);
            console.log("total fetched=%s", result.totalFetched);
            this.emit('end');
        })
        .on("error", (err) => {
            console.error(err);
            this.emit('error', err);
        })
        .run({autoFetch: true, maxFetch: 1000});
};
