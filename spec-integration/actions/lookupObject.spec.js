/* eslint-disable no-return-assign */
const fs = require('fs');
const sinon = require('sinon');
const { messages } = require('elasticio-node');
const chai = require('chai');
const logger = require('@elastic.io/component-logger')();
const lookupObject = require('../../lib/actions/lookupObject');

const { expect } = chai;

describe('lookupObject', () => {
  let message;
  let lastCall;
  let configuration;

  beforeEach(async () => {
    lastCall.reset();
  });

  before(async () => {
    if (fs.existsSync('.env')) {
      // eslint-disable-next-line global-require
      require('dotenv').config();
    }

    lastCall = sinon.stub(messages, 'newMessageWithBody')
      .returns(Promise.resolve());

    configuration = {
      apiVersion: '45.0',
      oauth: {
        instance_url: 'https://na38.salesforce.com',
        refresh_token: process.env.REFRESH_TOKEN,
        access_token: process.env.ACCESS_TOKEN,
      },
      prodEnv: 'login',
      sobject: 'Contact',
      _account: '5be195b7c99b61001068e1d0',
      lookupField: 'Id',
      typeOfSearch: 'uniqueFields',
    };
    message = {
      body: {
        Id: '00344000020qT3KAAU',
      },
    };
  });

  after(async () => {
    messages.newMessageWithBody.restore();
  });

  const emitter = {
    emit: sinon.spy(),
    logger,
  };

  it('looks up Contact Object ', async () => {
    await lookupObject.process.call(emitter, message, configuration)
      .then(() => {
        expect(lastCall.lastCall.args[0].attributes.type).to.eql('Contact');
      });
  });

  it('Contact Lookup fields ', async () => {
    await lookupObject.getLookupFieldsModel(configuration)
      .then((result) => {
        expect(result).to.be.deep.eql({
          Demo_Email__c: 'Demo Email (Demo_Email__c)',
          Id: 'Contact ID (Id)',
          extID__c: 'extID (extID__c)',
        });
      });
  });

  it('Contact linked objects ', async () => {
    const result = await lookupObject.getLinkedObjectsModel(configuration);
    expect(result).to.be.deep.eql({
      Account: 'Account (Account)',
      CreatedBy: 'User (CreatedBy)',
      LastModifiedBy: 'User (LastModifiedBy)',
      Individual: 'Individual (Individual)',
      MasterRecord: 'Contact (MasterRecord)',
      Owner: 'User (Owner)',
      ReportsTo: 'Contact (ReportsTo)',
      '!AcceptedEventRelations': 'AcceptedEventRelation (AcceptedEventRelations)',
      '!AccountContactRoles': 'AccountContactRole (AccountContactRoles)',
      '!ActivityHistories': 'ActivityHistory (ActivityHistories)',
      '!Assets': 'Asset (Assets)',
      '!AttachedContentDocuments': 'AttachedContentDocument (AttachedContentDocuments)',
      '!Attachments': 'Attachment (Attachments)',
      '!CampaignMembers': 'CampaignMember (CampaignMembers)',
      '!CaseContactRoles': 'CaseContactRole (CaseContactRoles)',
      '!Cases': 'Case (Cases)',
      '!CombinedAttachments': 'CombinedAttachment (CombinedAttachments)',
      '!ContactRequests': 'ContactRequest (ContactRequests)',
      '!ContentDocumentLinks': 'ContentDocumentLink (ContentDocumentLinks)',
      '!ContractContactRoles': 'ContractContactRole (ContractContactRoles)',
      '!ContractsSigned': 'Contract (ContractsSigned)',
      '!DeclinedEventRelations': 'DeclinedEventRelation (DeclinedEventRelations)',
      '!Devices__r': 'Device__c (Devices__r)',
      '!DuplicateRecordItems': 'DuplicateRecordItem (DuplicateRecordItems)',
      '!EmailMessageRelations': 'EmailMessageRelation (EmailMessageRelations)',
      '!EmailStatuses': 'EmailStatus (EmailStatuses)',
      '!EventRelations': 'EventRelation (EventRelations)',
      '!Events': 'Event (Events)',
      '!FeedSubscriptionsForEntity': 'EntitySubscription (FeedSubscriptionsForEntity)',
      '!Feeds': 'ContactFeed (Feeds)',
      '!Histories': 'ContactHistory (Histories)',
      '!ListEmailIndividualRecipients': 'ListEmailIndividualRecipient (ListEmailIndividualRecipients)',
      '!Notes': 'Note (Notes)',
      '!NotesAndAttachments': 'NoteAndAttachment (NotesAndAttachments)',
      '!OpenActivities': 'OpenActivity (OpenActivities)',
      '!Opportunities': 'Opportunity (Opportunities)',
      '!OpportunityContactRoles': 'OpportunityContactRole (OpportunityContactRoles)',
      '!OutgoingEmailRelations': 'OutgoingEmailRelation (OutgoingEmailRelations)',
      '!PersonRecord': 'UserEmailPreferredPerson (PersonRecord)',
      '!ProcessInstances': 'ProcessInstance (ProcessInstances)',
      '!ProcessSteps': 'ProcessInstanceHistory (ProcessSteps)',
      '!RecordActionHistories': 'RecordActionHistory (RecordActionHistories)',
      '!RecordActions': 'RecordAction (RecordActions)',
      '!RecordAssociatedGroups': 'CollaborationGroupRecord (RecordAssociatedGroups)',
      '!Shares': 'ContactShare (Shares)',
      '!Tasks': 'Task (Tasks)',
      '!TopicAssignments': 'TopicAssignment (TopicAssignments)',
      '!UndecidedEventRelations': 'UndecidedEventRelation (UndecidedEventRelations)',
      '!Users': 'User (Users)',
      '!dsfs__DocuSign_Envelope01__r': 'dsfs__DocuSign_Envelope__c (dsfs__DocuSign_Envelope01__r)',
      '!dsfs__DocuSign_Envelope_Recipient__r': 'dsfs__DocuSign_Envelope_Recipient__c (dsfs__DocuSign_Envelope_Recipient__r)',
      '!dsfs__DocuSign_Status__r': 'dsfs__DocuSign_Status__c (dsfs__DocuSign_Status__r)',
      '!dsfs__R00NS0000000WUMyMAO__r': 'dsfs__DocuSign_Recipient_Status__c (dsfs__R00NS0000000WUMyMAO__r)',
    });
  });

  it('Contact objectTypes ', async () => {
    await lookupObject.objectTypes.call(emitter, configuration)
      .then((result) => {
        expect(result.Account).to.be.eql('Account');
      });
  });

  it('Contact Lookup Meta', async () => {
    await lookupObject.getMetaModel.call(emitter, configuration)
      .then((result) => {
        expect(result.in).to.be.deep.eql({
          type: 'object',
          properties: {
            Id: {
              type: 'string',
              required: true,
              title: 'Contact ID',
              default: null,
            },
          },
        });
      });
  });
});
