var async = require('async');
var _ = require('underscore');

if (!process.env.SALESFORCE_KEY) {
    throw new Error("SALESFORCE_KEY environment environment variable is not set");
}
if (!process.env.SALESFORCE_SECRET) {
    throw new Error("SALESFORCE_SECRET environment variable is not set");
}
if (!process.env.SALESFORCE_REFRESH_TOKEN) {
    throw new Error("SALESFORCE_REFRESH_TOKEN environment variable is not set");
}

var newCallback = function(cb) {
    'use strict';
    return function(err, data, newSnapshot) {
        if (err) {
            console.log('Error: ', err);
            if (cb) {
                cb(err);
            }
        } else {
            console.log("Message: ", data, "Snapshot :", newSnapshot);
            console.log(JSON.stringify(data, null, '\t'));
            if (cb) {
                cb(null, data);
            }
        }
    };
};

var conf = require('./fixture.json').fixtures['lead-metamodel'].cfg;
conf.oauth.refresh_token = process.env.SALESFORCE_REFRESH_TOKEN;
var snapshot = '2013-01-04T13:46:27.823Z';// '2012-10-01T16:22:48.000Z';

var fns = [];

fns.push(function(callback) {
    'use strict';
    require('../actions/case.js').getMetaModel( _.clone(conf), newCallback(callback));
});

fns.push(function(callback) {
    'use strict';
    require('../actions/case.js').process(null, _.clone(conf), newCallback(callback), snapshot);
});

fns.push(function(callback) {
    'use strict';
    require('../entry.js').process(null, _.clone(conf), newCallback(callback), snapshot);
});


async.series(fns, newCallback());