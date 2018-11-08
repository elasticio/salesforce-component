/* eslint-disable no-return-assign */
const fs = require('fs');
const sinon = require('sinon');
const lookup = require('../lib/actions/lookup');
const {messages} = require('elasticio-node');
const chai = require('chai');
const {expect} = chai;

describe('lookup', () => {

  let message;
  let lastCall;
  let configuration;

  beforeEach(async () => {
    lastCall.reset();
  });

  before(async () => {
    if (fs.existsSync('.env')) {
      require('dotenv').config();
    }

    lastCall = sinon.stub(messages, 'newMessageWithBody')
        .returns(Promise.resolve());

    configuration =
        {
          apiVersion: '39.0',
          oauth: {
            issued_at: '1541510572760',
            token_type: 'Bearer',
            id: 'https://login.salesforce.com/id/00DE0000000dwKcMAI/005440000092zqdAAA',
            instance_url: 'https://na38.salesforce.com',
            id_token: 'eyJraWQiOiIyMTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdF9oYXNoIjoiRnNuSmp4RzlFY2RMNE05SWR3ekJoQSIsInN1YiI6Imh0dHBzOi8vbG9naW4uc2FsZXNmb3JjZS5jb20vaWQvMDBERTAwMDAwMDBkd0tjTUFJLzAwNTQ0MDAwMDA5MnpxZEFBQSIsImF1ZCI6IjNNVkc5eTZ4MDM1N0hsZWZiWFhrQmZySjJ0eG05bTZTYjVOWmxWQkZtTmZ6TlFXeTZyYUowX25LYW5XNFNnYU9qN0VKTUlJX0hMUHM5bWJCMEp4RTUiLCJpc3MiOiJodHRwczovL2xvZ2luLnNhbGVzZm9yY2UuY29tIiwiZXhwIjoxNTQxNTEwNjkyLCJpYXQiOjE1NDE1MTA1NzJ9.EZK6x7G9oF5vrpoL7v7Offg-9RR8txUUCjYmjQBUW_dBC7ZhMNwgKD2tN36Rf3avCbAyVd_B6FrVPiX7L8BCOnA-rEvFrzPKIXalo-Pm3qPM8L96fT3qp_7-bClO7wQtAmBaOmm6Td2OFKX-C6fP3yoAf3yp5MHZf_LKgYJA5AlQ8qtskwE5ZUyZpNnkQIfKG-gnxJTBU2njRazgIMGN_XRzNNU-JfAEvFvJ_mrHb6BiuvA3Qfc3nDXEALkzEacTzP1JLO22TT46xbLQGmcYvw_JP1ZTzyfzMhHGl_M8aJYkI3s-VHetAdoqQCXgSr02j1W-sECYOnZXODqt2Jd1a4LlpNvbrt6nEkArTFfX38s6z3jtpK8UiFjjYL5sfLRG9vnhu2yZIegZ5a_Lxr_Hw_m3oeZyoX3lS_wzoNaWzZ2bA438gRqvOH64Tn9--hDzHQLQFDKYuOvSWvmBf5bxo-dNDBGwGPQF0tlxnNGZ5SMKmVfQGxeUo_k4Ifg_zBsbBAFsZkLBeTm504YhJtnv1MQrA-k5MkZ78Zc8uW9cmPEbg6HEh57yOub1M5O9utJiU67cwXUI8-5C2NAbUW62-dEYEt_k5hdS_jtJ0e4gh5Mu2UK0ALlTs6TskMb_nTtC8DGJyFWjP7z0vRmQ2iyz5TOdMK7So3Iwdg2TNSrNkaQ',
            scope: 'refresh_token full',
            signature: 'C/X6deO0sSZVW9WCtrT4oFo741IpGtmGzSf8gNg8cnM=',
            refresh_token: process.env.REFRESH_TOKEN,
            access_token: process.env.ACCESS_TOKEN,
          },
          prodEnv: 'login',
          sobject: 'Contact',
          _account: '5be195b7c99b61001068e1d0',
          lookupField: 'AccountId',
          batchSize: 2,
        };
    message = {
      body: {
        AccountId: '0014400001ytQUJAA2',
      },
    };
  });

  after(async () => {
    messages.newMessageWithBody.restore();
  });

  const emitter = {
    emit: sinon.spy(),
  };

  it('lookup Contacts ', () => {
    lookup.process.call(emitter, message, configuration);
  });

  it('Contact Lookup fields ', async () => {
    lookup.getLookupFieldsModel(configuration)
        .then(result => {
          expect(result).to.be.deep.eql({
            Id: 'Contact ID',
            MasterRecordId: 'Master Record ID',
            AccountId: 'Account ID',
            ReportsToId: 'Reports To ID',
            OwnerId: 'Owner ID',
            CreatedById: 'Created By ID',
            LastModifiedById: 'Last Modified By ID',
            extID__c: 'extID',
          });
        });
  });
  it('Contact objectTypes ', async () => {
    lookup.objectTypes(configuration)
        .then(result => {
          expect(result.Account).to.be.eql("Account");
        });
  });

  it('Contact Lookup Meta', async () => {
    lookup.getMetaModel(configuration)
        .then(result => {
          expect(result).to.be.deep.eql({"in":{"type":"object","properties":{"AccountId":{"type":"string","required":false,"title":"Account ID","default":null}}},"out":{"type":"object","properties":{"Id":{"type":"string","required":true,"title":"Contact ID","default":null},"IsDeleted":{"type":"boolean","required":true,"title":"Deleted","default":false},"MasterRecordId":{"type":"string","required":false,"title":"Master Record ID","default":null},"AccountId":{"type":"string","required":false,"title":"Account ID","default":null},"LastName":{"type":"string","required":true,"title":"Last Name","default":null},"FirstName":{"type":"string","required":false,"title":"First Name","default":null},"Salutation":{"type":"string","enum":["Mr.","Ms.","Mrs.","Dr.","Prof."],"required":false,"title":"Salutation","default":null},"Name":{"type":"string","required":true,"title":"Full Name","default":null},"OtherStreet":{"type":"string","maxLength":1000,"required":false,"title":"Other Street","default":null},"OtherCity":{"type":"string","required":false,"title":"Other City","default":null},"OtherState":{"type":"string","required":false,"title":"Other State/Province","default":null},"OtherPostalCode":{"type":"string","required":false,"title":"Other Zip/Postal Code","default":null},"OtherCountry":{"type":"string","required":false,"title":"Other Country","default":null},"OtherLatitude":{"type":"float","required":false,"title":"Other Latitude","default":null},"OtherLongitude":{"type":"float","required":false,"title":"Other Longitude","default":null},"OtherGeocodeAccuracy":{"type":"string","enum":["Address","NearAddress","Block","Street","ExtendedZip","Zip","Neighborhood","City","County","State","Unknown"],"required":false,"title":"Other Geocode Accuracy","default":null},"OtherAddress":{"type":"object","properties":{"city":{"type":"string"},"country":{"type":"string"},"postalCode":{"type":"string"},"state":{"type":"string"},"street":{"type":"string"}},"required":false,"title":"Other Address","default":null},"MailingStreet":{"type":"string","maxLength":1000,"required":false,"title":"Mailing Street","default":null},"MailingCity":{"type":"string","required":false,"title":"Mailing City","default":null},"MailingState":{"type":"string","required":false,"title":"Mailing State/Province","default":null},"MailingPostalCode":{"type":"string","required":false,"title":"Mailing Zip/Postal Code","default":null},"MailingCountry":{"type":"string","required":false,"title":"Mailing Country","default":null},"MailingLatitude":{"type":"float","required":false,"title":"Mailing Latitude","default":null},"MailingLongitude":{"type":"float","required":false,"title":"Mailing Longitude","default":null},"MailingGeocodeAccuracy":{"type":"string","enum":["Address","NearAddress","Block","Street","ExtendedZip","Zip","Neighborhood","City","County","State","Unknown"],"required":false,"title":"Mailing Geocode Accuracy","default":null},"MailingAddress":{"type":"object","properties":{"city":{"type":"string"},"country":{"type":"string"},"postalCode":{"type":"string"},"state":{"type":"string"},"street":{"type":"string"}},"required":false,"title":"Mailing Address","default":null},"Phone":{"type":"string","required":false,"title":"Business Phone","default":null},"Fax":{"type":"string","required":false,"title":"Business Fax","default":null},"MobilePhone":{"type":"string","required":false,"title":"Mobile Phone","default":null},"HomePhone":{"type":"string","required":false,"title":"Home Phone","default":null},"OtherPhone":{"type":"string","required":false,"title":"Other Phone","default":null},"AssistantPhone":{"type":"string","required":false,"title":"Asst. Phone","default":null},"ReportsToId":{"type":"string","required":false,"title":"Reports To ID","default":null},"Email":{"type":"string","required":false,"title":"Email","default":null},"Title":{"type":"string","required":false,"title":"Title","default":null},"Department":{"type":"string","required":false,"title":"Department","default":null},"AssistantName":{"type":"string","required":false,"title":"Assistant's Name","default":null},"LeadSource":{"type":"string","enum":["Web","Phone Inquiry","Partner Referral","Purchased List","Other"],"required":false,"title":"Lead Source","default":null},"Birthdate":{"type":"date","required":false,"title":"Birthdate","default":null},"Description":{"type":"string","maxLength":1000,"required":false,"title":"Contact Description","default":null},"OwnerId":{"type":"string","required":true,"title":"Owner ID","default":null},"CreatedDate":{"type":"date","required":true,"title":"Created Date","default":null},"CreatedById":{"type":"string","required":true,"title":"Created By ID","default":null},"LastModifiedDate":{"type":"date","required":true,"title":"Last Modified Date","default":null},"LastModifiedById":{"type":"string","required":true,"title":"Last Modified By ID","default":null},"SystemModstamp":{"type":"date","required":true,"title":"System Modstamp","default":null},"LastActivityDate":{"type":"date","required":false,"title":"Last Activity","default":null},"LastCURequestDate":{"type":"date","required":false,"title":"Last Stay-in-Touch Request Date","default":null},"LastCUUpdateDate":{"type":"date","required":false,"title":"Last Stay-in-Touch Save Date","default":null},"LastViewedDate":{"type":"date","required":false,"title":"Last Viewed Date","default":null},"LastReferencedDate":{"type":"date","required":false,"title":"Last Referenced Date","default":null},"EmailBouncedReason":{"type":"string","required":false,"title":"Email Bounced Reason","default":null},"EmailBouncedDate":{"type":"date","required":false,"title":"Email Bounced Date","default":null},"IsEmailBounced":{"type":"boolean","required":true,"title":"Is Email Bounced","default":false},"PhotoUrl":{"type":"string","required":false,"title":"Photo URL","default":null},"Jigsaw":{"type":"string","required":false,"title":"Data.com Key","default":null},"JigsawContactId":{"type":"string","required":false,"title":"Jigsaw Contact ID","default":null},"Level__c":{"type":"string","enum":["Secondary","Tertiary","Primary"],"required":false,"title":"Level","default":null},"Languages__c":{"type":"string","required":false,"title":"Languages","default":null},"extID__c":{"type":"string","required":false,"title":"extID","default":null}}}}
          );
        });
  });
});
