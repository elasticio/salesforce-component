const util = require('util');
const vm = require('vm');
const jsforce = require('jsforce');

/**
 * See list on https://na45.salesforce.com/services/data/
 * @type {string}
 */
const SALESFORCE_API_VERSION = '39.0';

/**
 * This function will return a query
 *
 * @param template a query template like "SELECT Id, Name, CreatedDate FROM Contact WHERE LastName LIKE '${body.foo}'"
 * @param msg elastic.io message
 */
function prepareStatement(template, msg) {
    const context = msg || {};
    const script = new vm.Script(util.format('__eio_eval_result = `%s`', template));
    script.runInContext(vm.createContext(context));
    return context.__eio_eval_result;
}


exports.process = function processAction(msg, conf) {
    console.log('Starting SOQL Select query=%s msg=%j', conf.query, msg);
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
    const query = prepareStatement(conf.query, msg);
    console.log('Prepared query=%s', query);
    const result = conn.query(query)
        .on("record", (record) => {
            this.emit('data', record);
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
