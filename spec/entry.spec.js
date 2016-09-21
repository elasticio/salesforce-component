describe('Salesforce Entry', function () {
    var entry = require('../lib/entry.js');
    var elasticio = require('elasticio-node');
    var messages = elasticio.messages;
    var nock = require('nock');
    var Q = require('q');
    var _ = require('lodash');
    var proxyquire = require('proxyquire');
    var RequestEmulation = require('./requestEmulation.js').RequestEmulation;
    var oAuthUtils = require('../lib/helpers/oauth-utils.js');

    var callScope = {
        request: new RequestEmulation(),
        emit: function(){}
    };

    var sfEntry = new entry.SalesforceEntity(callScope);

    beforeEach(function() {
        spyOn(sfEntry, "refreshToken").andCallThrough();
        spyOn(oAuthUtils, "refreshAppToken").andCallFake(function (component, conf, next) {
            var refreshedCfg = _.clone(conf);
            refreshedCfg.oauth.access_token = "aRefreshedToken";
            next(null, refreshedCfg);
        });
        spyOn(callScope, "emit").andCallFake(function(){});
        spyOn(callScope.request, "emit").andCallFake(function(){});
    });

    var singleContact = {
        attributes: {
            type: 'Contact',
            url: '/services/data/v25.0/sobjects/Contact/003E000000ks8ctIAA'
        },
        SystemModstamp: '2013-10-13T18:33:27.000+0000'
    };

    var queryContactsResponse = {
        totalSize: 30,
        records : [
            singleContact
        ]
    };

    var retrieveContactsResponse = singleContact;

    describe('Process', function () {

        it('should handle the API_DISABLED_FOR_ORG error code by creating a specific error with error code', function () {

            var apiResponse = [{
                "message":"The REST API is not enabled for this Organization.",
                "errorCode":"API_DISABLED_FOR_ORG"
            }];

            nock('http://localhost:1234')
                .get('/services/data/v25.0/sobjects/Contact/describe')
                .reply(403, JSON.stringify(apiResponse));

            var cfg = {
                object : "Contact",
                oauth : {
                    instance_url : "http://localhost:1234",
                    access_token : "aToken",
                    refresh_token : "rToken"
                }
            };

            var msg = messages.newEmptyMessage();

            runs(function () {
                sfEntry.processTrigger(msg, cfg, '1978-04-06T11:00:00.000Z');
            });

            waitsFor(function () {
                return callScope.emit.callCount >= 2;
            });


            runs(function () {

                expect(sfEntry.refreshToken).toHaveBeenCalledWith(cfg, jasmine.any(Function));

                expect(callScope.emit).toHaveBeenCalled();
                expect(callScope.emit.calls[0].args[0]).toEqual('updateKeys');

                expect(callScope.emit.calls[1].args[0]).toEqual('error');
                var error = callScope.emit.calls[1].args[1];
                expect(error).toBeDefined();
                expect(error.statusCode).toEqual(403);
                expect(error.view.textKey).toEqual('salesforce_API_DISABLED_FOR_ORG');
                expect(error.view.defaultText).toEqual('The REST API is not enabled for this Organization.');
            });
        });

        it('Query Returns No Objects', function () {

            nock('http://localhost:1234')
                .get('/services/data/v25.0/sobjects/Contact/describe')
                .reply(200, JSON.stringify(require('./objectDescription.json')))
                .get('/services/data/v25.0/query?q=select%20Id%2CLastName%2CFirstName%2CSalutation%2COtherStreet%2COtherCity%2COtherState%2COtherPostalCode%2COtherCountry%2CMailingStreet%2CMailingCity%2CMailingState%2CMailingPostalCode%2CMailingCountry%2CPhone%2CFax%2CMobilePhone%2CHomePhone%2COtherPhone%2CAssistantPhone%2CEmail%2CTitle%2CDepartment%2CAssistantName%2CLeadSource%2CBirthdate%2CDescription%2CEmailBouncedReason%2CEmailBouncedDate%2CJigsaw%2CLevel__c%2CLanguages__c%20from%20Contact%20where%20SystemModstamp%20%3E%201978-04-06T11%3A00%3A00.000Z')
                .matchHeader('Authorization', 'Bearer aRefreshedToken')
                .reply(200, JSON.stringify({ totalSize: 0 }));

            var cfg = {
                object : "Contact",
                oauth : {
                    instance_url : "http://localhost:1234",
                    access_token : "aToken"
                }
            };

            var msg = messages.newEmptyMessage();

            runs(function () {
                sfEntry.processTrigger(msg, cfg, '1978-04-06T11:00:00.000Z');
            });

            waitsFor(function () {
                return callScope.emit.callCount >= 2;
            });


            runs(function () {
                expect(callScope.emit).toHaveBeenCalled();
                expect(callScope.emit.calls[0].args[0]).toEqual('updateKeys');

                expect(callScope.emit.calls[1].args[0]).toEqual('end');
                expect(sfEntry.refreshToken).toHaveBeenCalledWith(cfg, jasmine.any(Function));
            });
        });


        it('Query and Retrieve Objects', function () {

            nock('http://localhost:1234')
                .get('/services/data/v25.0/sobjects/Contact/describe')
                .reply(200, JSON.stringify(require('./objectDescription.json')))
                .get('/services/data/v25.0/query?q=select%20Id%2CLastName%2CFirstName%2CSalutation%2COtherStreet%2COtherCity%2COtherState%2COtherPostalCode%2COtherCountry%2CMailingStreet%2CMailingCity%2CMailingState%2CMailingPostalCode%2CMailingCountry%2CPhone%2CFax%2CMobilePhone%2CHomePhone%2COtherPhone%2CAssistantPhone%2CEmail%2CTitle%2CDepartment%2CAssistantName%2CLeadSource%2CBirthdate%2CDescription%2CEmailBouncedReason%2CEmailBouncedDate%2CJigsaw%2CLevel__c%2CLanguages__c%20from%20Contact%20where%20SystemModstamp%20%3E%201978-04-06T11%3A00%3A00.000Z')
                .matchHeader('Authorization', 'Bearer aRefreshedToken')
                .reply(200, JSON.stringify(queryContactsResponse))
                .get('/services/data/v25.0/sobjects/Contact/003E000000ks8ctIAA')
                .matchHeader('Authorization', 'Bearer aRefreshedToken')
                .reply(200, JSON.stringify(retrieveContactsResponse));


            var cfg = {
                object : "Contact",
                oauth : {
                    instance_url : "http://localhost:1234",
                    access_token : "aToken"
                }
            };

            var msg = messages.newEmptyMessage();

            runs(function () {
                sfEntry.processTrigger(msg, cfg, '1978-04-06T11:00:00.000Z');
            });

            waitsFor(function () {
                return callScope.emit.callCount>= 2;
            });


            runs(function () {
                expect(sfEntry.refreshToken).toHaveBeenCalledWith(cfg, jasmine.any(Function));
                //expect(callScope.emit).toHaveBeenCalled();

                expect(callScope.emit).toHaveBeenCalled();
                expect(callScope.emit.calls[0].args[0]).toEqual('updateKeys');

                expect(callScope.emit.calls[1].args[0]).toEqual('data');
                var result = callScope.emit.calls[1].args[1];
                expect(result.body).toEqual(require('./expectedMessage.json').body);
                expect(result.headers).toEqual(require('./expectedMessage.json').headers);
                expect(result.metadata).toEqual(require('./expectedMessage.json').metadata);
            });
        });

        it('Query and Retrieve Other Objects', function () {

            spyOn(entry, 'SalesforceEntity').andReturn(sfEntry);

            nock('http://localhost:1234')
                .get('/services/data/v25.0/sobjects/Event/describe')
                .reply(200, JSON.stringify(require('./objectDescription.json')))
                .get('/services/data/v25.0/query?q=select%20Id%2CLastName%2CFirstName%2CSalutation%2COtherStreet%2COtherCity%2COtherState%2COtherPostalCode%2COtherCountry%2CMailingStreet%2CMailingCity%2CMailingState%2CMailingPostalCode%2CMailingCountry%2CPhone%2CFax%2CMobilePhone%2CHomePhone%2COtherPhone%2CAssistantPhone%2CEmail%2CTitle%2CDepartment%2CAssistantName%2CLeadSource%2CBirthdate%2CDescription%2CEmailBouncedReason%2CEmailBouncedDate%2CJigsaw%2CLevel__c%2CLanguages__c%20from%20Event%20where%20SystemModstamp%20%3E%201978-04-06T11%3A00%3A00.000Z')
                .matchHeader('Authorization', 'Bearer aRefreshedToken')
                .reply(200, JSON.stringify(queryContactsResponse))
                .get('/services/data/v25.0/sobjects/Event/003E000000ks8ctIAA')
                .matchHeader('Authorization', 'Bearer aRefreshedToken')
                .reply(200, JSON.stringify(retrieveContactsResponse));


            var cfg = {
                object : "Event",
                oauth : {
                    instance_url : "http://localhost:1234",
                    access_token : "aToken"
                }
            };

            var msg = messages.newEmptyMessage();

            runs(function () {
                entry.process.call(callScope, msg, cfg, '1978-04-06T11:00:00.000Z');
            });

            waitsFor(function () {
                return callScope.emit.callCount > 3;
            });

            runs(function () {

                expect(callScope.emit).toHaveBeenCalled();
                expect(callScope.emit.calls[0].args[0]).toEqual('updateKeys');
                expect(callScope.emit.calls.length).toEqual(4);
                expect(callScope.emit.calls[1].args[0]).toEqual('data');
                var result = callScope.emit.calls[1].args[1];
                expect(result.body).toEqual(require('./expectedMessage.json').body);
                expect(result.headers).toEqual(require('./expectedMessage.json').headers);
                expect(result.metadata).toEqual(require('./expectedMessage.json').metadata);
            });
        });
    });

    describe('Action tests', function () {

        it('New Contacts', function () {

            nock('http://localhost:1234')
                .post('/services/data/v25.0/sobjects/Contact')
                .matchHeader('Authorization', 'Bearer aRefreshedToken')
                .reply(201, JSON.stringify({ message : "ok"}));

            var cfg = {
                oauth : {
                    instance_url : "http://localhost:1234",
                    access_token : "aToken"
                }
            };

            var msg = messages.newEmptyMessage();
            msg.id = '3a5b5180-b657-11e3-9a8d-490f40cd5e5b';

            runs(function () {

                var action = {};

                entry.buildAction("Contact", action);

                action.process.call(callScope, msg, cfg, '1978-04-06T11:00:00.000Z');
            });

            waitsFor(function () {
                return callScope.emit.callCount >= 2;
            });

            runs(function () {

                expect(callScope.emit).toHaveBeenCalled();
                expect(callScope.emit.calls[0].args[0]).toEqual('updateKeys');

                expect(callScope.emit.calls[1].args[0]).toEqual('data');
                var result = callScope.emit.calls[1].args[1];
                expect(result).toEqual({
                    id : '3a5b5180-b657-11e3-9a8d-490f40cd5e5b',
                    attachments : {},
                    body : { message : 'ok' },
                    headers : {},
                    metadata : {}
                });
            });
        });

        it('Get In Metadata', function () {

            nock('http://localhost:1234')
                .matchHeader('Authorization', 'Bearer aRefreshedToken')
                .get('/services/data/v25.0/sobjects/Contact/describe')
                .reply(200, JSON.stringify(require('./objectDescription.json')));

            var cfg = {
                oauth : {
                    instance_url : "http://localhost:1234",
                    access_token : "aToken"
                }
            };

            var msg = messages.newEmptyMessage();
            msg.id = '3a5b5180-b657-11e3-9a8d-490f40cd5e5b';

            var result;
            var error;

            runs(function () {

                var action = {};

                entry.buildAction("Contact", action);

                action.getMetaModel.call(callScope, cfg, function(err, meta) {
                    error = err;
                    result = meta;
                });
            });

            waitsFor(function () {
                return result;
            });


            runs(function () {
                expect(error).toBeNull();
                expect(result.in).toEqual(require('./expectedMessage.json').metadata);
                expect(result.out.properties.in).toEqual({ type : 'string', required : true });
            });
        });

    });

    describe('Trigger tests', function () {

        it('Get Out Metadata', function () {

            nock('http://localhost:1234')
                .matchHeader('Authorization', 'Bearer aRefreshedToken')
                .get('/services/data/v25.0/sobjects/Contact/describe')
                .reply(200, JSON.stringify(require('./objectDescription.json')));

            var cfg = {
                oauth : {
                    instance_url : "http://localhost:1234",
                    access_token : "aToken"
                }
            };

            var msg = messages.newEmptyMessage();
            msg.id = '3a5b5180-b657-11e3-9a8d-490f40cd5e5b';

            var result;
            var error;

            runs(function () {

                var trigger = {};

                entry.buildTrigger("Contact", trigger);

                trigger.getMetaModel.call(callScope, cfg, function(err, meta) {
                    error = err;
                    result = meta;
                });
            });

            waitsFor(function () {
                return result;
            });


            runs(function () {
                expect(error).toBeNull();

                expect(result).toEqual({
                    out : require('./expectedMessage.json').metadata
                });
            });
        });

    });

    describe('Get other entity metadata', function () {

        it('Get Out Metadata, other entity type', function () {

            spyOn(entry, 'SalesforceEntity').andReturn(sfEntry);

            nock('http://localhost:1234')
                .matchHeader('Authorization', 'Bearer aRefreshedToken')
                .get('/services/data/v25.0/sobjects/Event/describe')
                .reply(200, JSON.stringify(require('./objectDescription.json')));

            var cfg = {
                object : "Event",
                oauth : {
                    instance_url : "http://localhost:1234",
                    access_token : "aToken"
                }
            };

            var msg = messages.newEmptyMessage();
            msg.id = '3a5b5180-b657-11e3-9a8d-490f40cd5e5b';

            var result;
            var error;

            runs(function () {

                entry.getMetaModel.call(callScope, cfg, function(err, meta) {
                    error = err;
                    result = meta;
                });
            });

            waitsFor(function () {
                return result;
            });


            runs(function () {
                expect(error).toBeNull();
                expect(result).toEqual({
                    out : require('./expectedMessage.json').metadata
                });
            });
        });
    });

    describe('Get object types', function () {

        it('should return object types', function () {

            spyOn(entry, 'SalesforceEntity').andReturn(sfEntry);

            nock('http://localhost:1234')
                .matchHeader('Authorization', 'Bearer aRefreshedToken')
                .get('/services/data/v25.0/sobjects')
                .reply(200, JSON.stringify(require('./objectsList.json')));

            var cfg = {
                oauth : {
                    instance_url : "http://localhost:1234",
                    access_token : "aToken"
                }
            };

            var msg = messages.newEmptyMessage();
            msg.id = '3a5b5180-b657-11e3-9a8d-490f40cd5e5b';

            var result;
            var error;

            runs(function () {
                entry.objectTypes.call(callScope, cfg, function(err, meta) {
                    error = err;
                    result = meta;
                });
            });

            waitsFor(function () {
                return result;
            });


            runs(function () {
                expect(error).toBeNull();
                expect(result).toEqual({Account: 'Account', AccountContactRole: 'Account Contact Role'});
            });
        });
    });

    describe('processQuery', function() {

        var expectedUpdateKeysData = {
            oauth: {
                instance_url: 'http://localhost:1234',
                access_token: 'aRefreshedToken'
            }
        };
        describe('when objectFetcher returns data', function() {
            var sfEntry;
            beforeEach(function() {

                function fakeFetchObjects() {
                    return Q({
                            objects: {
                                totalSize: 20,
                                done: true,
                                records: [
                                    {
                                        FirstName: 'Tim',
                                        LastName: 'Barr',
                                        Id: '0030Y000001plTAQAY',
                                        attributes: {
                                            url: '/services/data/v25.0/sobjects/Contact/0030Y000001plTAQAY',
                                            type: 'Contact'
                                        }
                                    },
                                    {
                                        FirstName: 'Josh',
                                        LastName: 'Davis',
                                        Id: '0030Y000001plTFQAY',
                                        attributes: {
                                            url: '/services/data/v25.0/sobjects/Contact/0030Y000001plTFQAY',
                                            type: 'Contact'
                                        }
                                    }
                                ]
                            }
                        }
                    );
                }

                var SalesforceEntity = proxyquire('../lib/entry.js', {
                    './helpers/objectFetcherQuery': fakeFetchObjects
                }).SalesforceEntity;

                sfEntry = new SalesforceEntity(callScope);

            });

            it('should emit "data" event with relevant content among with "end" event', function() {

                var cfg = {
                    oauth: {
                        instance_url: "http://localhost:1234",
                        access_token: "aToken"
                    }
                };

                runs(function() {
                    var query = 'SELECT id, LastName, FirstName ' +
                        'FROM Contact ' +
                        'WHERE SystemModstamp >  2016-09-02T12:30:41.120Z';

                    sfEntry.processQuery.call(callScope, query, cfg);
                });

                waitsFor(function() {
                    return callScope.emit.callCount >= 3;
                });

                runs(function() {

                    expect(callScope.emit).toHaveBeenCalled();
                    expect(callScope.emit.calls[0].args).toEqual(['updateKeys', expectedUpdateKeysData]);

                    expect(callScope.emit.calls[1].args[0]).toEqual('data');
                    var actualDataRecord1 = callScope.emit.calls[1].args[1];
                    var expectedDataRecord1 = {
                        id: jasmine.any(String),
                        attachments: {},
                        body: {
                            FirstName: 'Tim',
                            LastName: 'Barr',
                            Id: '0030Y000001plTAQAY',
                            attributes: {
                                url: '/services/data/v25.0/sobjects/Contact/0030Y000001plTAQAY',
                                type: 'Contact'
                            }
                        },
                        headers: {
                            objectId: '/services/data/v25.0/sobjects/Contact/0030Y000001plTAQAY'
                        },
                        metadata: {}
                    };
                    expect(actualDataRecord1).toEqual(expectedDataRecord1);

                    expect(callScope.emit.calls[2].args[0]).toEqual('data');
                    var actualDataRecord2 = callScope.emit.calls[2].args[1];
                    var expectedDataRecord2 = {
                        id: jasmine.any(String),
                        attachments: {},
                        body: {
                            FirstName: 'Josh',
                            LastName: 'Davis',
                            Id: '0030Y000001plTFQAY',
                            attributes: {
                                url: '/services/data/v25.0/sobjects/Contact/0030Y000001plTFQAY',
                                type: 'Contact'
                            }
                        },
                        headers: {
                            objectId: '/services/data/v25.0/sobjects/Contact/0030Y000001plTFQAY'
                        },
                        metadata: {}
                    };
                    expect(actualDataRecord2).toEqual(expectedDataRecord2);

                    expect(callScope.emit.calls[3].args).toEqual(['end']);
                });
            })
        });

        describe('when objectFetcher returns empty set', function() {
            var sfEntry;
            beforeEach(function() {

                function fakeFetchObjects() {
                    return Q({
                            objects: {
                                totalSize: 0,
                                done: true,
                                records: []
                            }
                        }
                    );
                }

                var SalesforceEntity = proxyquire('../lib/entry.js', {
                    './helpers/objectFetcherQuery': fakeFetchObjects
                }).SalesforceEntity;

                sfEntry = new SalesforceEntity(callScope);

            });

            it('should emit "end" event and no any "data" event', function() {

                var cfg = {
                    oauth: {
                        instance_url: "http://localhost:1234",
                        access_token: "aToken"
                    }
                };

                runs(function() {
                    var query = 'SELECT id, LastName, FirstName ' +
                        'FROM Contact ' +
                        'WHERE SystemModstamp >  2056-09-02T12:32:41.361Z';

                    sfEntry.processQuery.call(callScope, query, cfg);
                });

                waitsFor(function() {
                    return callScope.emit.callCount >= 2;
                });

                runs(function() {

                    expect(callScope.emit).toHaveBeenCalled();
                    expect(callScope.emit.calls[0].args).toEqual(['updateKeys', expectedUpdateKeysData]);

                    expect(callScope.emit.calls[1].args).toEqual(['end']);
                });
            })
        });
        describe('when objectFetcher rejects', function() {
            var sfEntry;
            var expectedError;
            beforeEach(function() {

                function fakeFetchObjects() {
                    expectedError = new Error('Something has happened')
                    return Q.reject(error);
                }

                var SalesforceEntity = proxyquire('../lib/entry.js', {
                    './helpers/objectFetcherQuery': fakeFetchObjects
                }).SalesforceEntity;

                sfEntry = new SalesforceEntity(callScope);

            });

            it('should emit "error" event among with "end"', function() {

                var cfg = {
                    oauth: {
                        instance_url: "http://localhost:1234",
                        access_token: "aToken"
                    }
                };

                runs(function() {
                    var query = 'SELECT id, LastName, FirstName ' +
                        'FROM Contact ' +
                        'WHERE SystemModstamp >  2056-09-02T12:33:41.361Z';

                    sfEntry.processQuery.call(callScope, query, cfg);
                });

                waitsFor(function() {
                    return callScope.emit.callCount >= 3;
                });

                runs(function() {

                    expect(callScope.emit).toHaveBeenCalled();
                    expect(callScope.emit.calls[0].args).toEqual(['updateKeys', expectedUpdateKeysData]);

                    expect(callScope.emit.calls[1].args).toEqual(['error', expectedError]);
                    expect(callScope.emit.calls[2].args).toEqual(['end']);
                });
            })
        });
    });
});
