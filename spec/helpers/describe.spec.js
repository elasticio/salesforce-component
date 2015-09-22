describe('Saleforce Describe', function () {

    var salesforceDescribe = require('../../lib/helpers/describe').describeObject;
    var nock = require('nock');
    var description = require('../objectDescription.json');

    it('should fetch a description for the specified object type', function () {

        var params = {};
        params.cfg = {
            oauth: {
                access_token: "00DE0000000dwKc!ARcAQEgJMHustyszwbrh06CGCuYPn2aI..bAV4T8aA8aDXRpAWeveWq7jhUlGl7d2e7T8itqCX1F0f_LeuMDiGzZrdOIIVnE",
                signature: "BVzAhWIq0NNzW+H0ehXq5ddLAPAX1J5wMmbpqHiURsQ=",
                refresh_token: "5Aep861rEpScxnNE66jGO6gqeJ82V9qXOs5YIxlkVZgWYMSJfjLeqYUwKNfA2R7cU04EyjVKE9_A.vqQY9kjgUg",
                token_type: "Bearer",
                instance_url: "https://na9.salesforce.com",
                scope: "id api refresh_token",
                issued_at: "1396940795887",
                id: "https://login.salesforce.com/id/00DE0000000dwKcMAI/005E0000002CozkIAC"
            },
            object: 'Contact',
            apiVersion: "v25.0"
        };

        var result;

        nock('https://na9.salesforce.com').get('/services/data/v25.0/sobjects/Contact/describe').reply(200, JSON.stringify(description));

        runs(function () {
            salesforceDescribe(params).then(function (description) {
                result = description;
            });
        });

        waitsFor(function () {
            return result;
        });

        runs(function () {
            expect(result).toEqual(JSON.parse(JSON.stringify(description)));
        });
    });
});