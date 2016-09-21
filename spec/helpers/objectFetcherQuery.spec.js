'use strict';

describe('Fetching objects', function() {

    var nock = require('nock');
    var fetchObjects = require('../../lib/helpers/objectFetcherQuery');

    var params = {};
    var token = token;

    beforeEach(function() {
        params = {
            cfg: {
                oauth: {
                    access_token: token,
                    instance_url: 'https://eu11.salesforce.com'
                },
                apiVersion: 'v25.0'
            },
            query: 'SELECT id, LastName, FirstName FROM Contact'
        };
    });


    it('should send given query and return result', function() {

        var expectedResult = [];
        nock('https://eu11.salesforce.com')
            .get('/services/data/v25.0/query?q=SELECT%20id%2C%20LastName%2C%20FirstName%20FROM%20Contact')
            .matchHeader('Authorization', 'Bearer ' + token)
            .reply(200, []);

        var objectsPromise = fetchObjects(params);

        var result;
        runs(function() {
            objectsPromise.then(function(params) {
                result = params;
            });
        });

        waitsFor(function() {
            return result;
        });
        runs(function() {
            expect(result.objects).toBeDefined();
            expect(result.objects).toEqual(expectedResult);
        });

    });

    it('should throw an error if no cfg provided', function() {

        delete params.cfg;

        expect(function() {
            fetchObjects(params);
        }).toThrow(new Error('Can\'t fetch objects without a configuration parameter'));
    });

    it('should throw an error if no apiVersion provided', function() {

        params.cfg.apiVersion = undefined;

        expect(function() {
            fetchObjects(params);
        }).toThrow(new Error('Can\'t fetch objects without an apiVersion'));
    });

    it('should throw an error if no object provided', function() {

        delete params.query;

        expect(function() {
            fetchObjects(params);
        }).toThrow(new Error('Can\'t fetch objects without a query'));
    });
});
