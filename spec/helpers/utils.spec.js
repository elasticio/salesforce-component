const { expect } = require('chai');
const { processMeta, getLinkedObjectTypes, getLookupFieldsModelWithTypeOfSearch } = require('../../lib/helpers/utils');
const contactDescription = require('../testData/objectDescription.json');
const metaModelDocumentReply = require('../testData/sfDocumentMetadata.json');

describe('utils helper', () => {
  describe('processMeta helper', () => {
    const meta = contactDescription;
    it('should succeed create metadata for metaType create', async () => {
      const metaType = 'create';
      const result = await processMeta(meta, metaType);
      expect(result.in.properties.LastName).to.eql({
        type: 'string',
        required: true,
        title: 'Last Name',
        default: null,
      });
      expect(result.out.properties.id).to.eql({
        type: 'string',
        required: true,
      });
    });

    it('should succeed create metadata for metaType upsert', async () => {
      const metaType = 'upsert';
      const result = await processMeta(meta, metaType);
      expect(result.in.properties.LastName).to.eql({
        type: 'string',
        required: false,
        title: 'Last Name',
        default: null,
      });
    });

    it('should succeed create metadata for metaType lookup', async () => {
      const metaType = 'lookup';
      const lookupField = 'Id';

      const result = await processMeta(meta, metaType, lookupField);
      expect(result.in.properties).to.eql({
        Id: {
          default: null,
          required: false,
          title: 'Contact ID',
          type: 'string',
        },
      });
    });
  });

  describe('getLinkedObjectTypes helper', () => {
    it('should succeed getLinkedObjectTypes Document', async () => {
      const expectedResult = {
        Folder: 'Folder, User (Folder)',
        Author: 'User (Author)',
        CreatedBy: 'User (CreatedBy)',
        LastModifiedBy: 'User (LastModifiedBy)',
      };
      const result = await getLinkedObjectTypes(metaModelDocumentReply);
      expect(result).to.eql(expectedResult);
    });

    it('should succeed getLinkedObjectTypes Contact', async () => {
      const expectedResult = {
        MasterRecord: 'Contact (MasterRecord)',
        Account: 'Account (Account)',
        ReportsTo: 'Contact (ReportsTo)',
        Owner: 'User (Owner)',
        CreatedBy: 'User (CreatedBy)',
        LastModifiedBy: 'User (LastModifiedBy)',
        '!AccountContactRoles': 'AccountContactRole (AccountContactRoles)',
        '!ActivityHistories': 'ActivityHistory (ActivityHistories)',
        '!Assets': 'Asset (Assets)',
        '!Attachments': 'Attachment (Attachments)',
        '!CampaignMembers': 'CampaignMember (CampaignMembers)',
        '!Cases': 'Case (Cases)',
        '!CaseContactRoles': 'CaseContactRole (CaseContactRoles)',
        '!Feeds': 'ContactFeed (Feeds)',
        '!Histories': 'ContactHistory (Histories)',
        '!Shares': 'ContactShare (Shares)',
        '!ContractsSigned': 'Contract (ContractsSigned)',
        '!ContractContactRoles': 'ContractContactRole (ContractContactRoles)',
        '!EmailStatuses': 'EmailStatus (EmailStatuses)',
        '!FeedSubscriptionsForEntity': 'EntitySubscription (FeedSubscriptionsForEntity)',
        '!Events': 'Event (Events)',
        '!Notes': 'Note (Notes)',
        '!NotesAndAttachments': 'NoteAndAttachment (NotesAndAttachments)',
        '!OpenActivities': 'OpenActivity (OpenActivities)',
        '!OpportunityContactRoles': 'OpportunityContactRole (OpportunityContactRoles)',
        '!ProcessInstances': 'ProcessInstance (ProcessInstances)',
        '!ProcessSteps': 'ProcessInstanceHistory (ProcessSteps)',
        '!Tasks': 'Task (Tasks)',
      };
      const result = await getLinkedObjectTypes(contactDescription);
      expect(result).to.eql(expectedResult);
    });
  });

  describe('getLookupFieldsModelWithTypeOfSearch helper', () => {
    const typesOfSearch = {
      uniqueFields: 'uniqueFields',
      allFields: 'allFields',
    };

    it('should succeed getLookupFieldsModelWithTypeOfSearch Contact uniqueFields', async () => {
      const result = await getLookupFieldsModelWithTypeOfSearch(contactDescription, typesOfSearch.uniqueFields);
      expect(result).to.eql({
        Id: 'Contact ID (Id)',
      });
    });

    it('should succeed getLookupFieldsModelWithTypeOfSearch Contact allFields', async () => {
      const result = await getLookupFieldsModelWithTypeOfSearch(contactDescription, typesOfSearch.allFields);
      expect(result).to.eql({
        Id: 'Contact ID (Id)',
        IsDeleted: 'Deleted (IsDeleted)',
        MasterRecordId: 'Master Record ID (MasterRecordId)',
        AccountId: 'Account ID (AccountId)',
        LastName: 'Last Name (LastName)',
        FirstName: 'First Name (FirstName)',
        Salutation: 'Salutation (Salutation)',
        Name: 'Full Name (Name)',
        OtherStreet: 'Other Street (OtherStreet)',
        OtherCity: 'Other City (OtherCity)',
        OtherState: 'Other State/Province (OtherState)',
        OtherPostalCode: 'Other Zip/Postal Code (OtherPostalCode)',
        OtherCountry: 'Other Country (OtherCountry)',
        MailingStreet: 'Mailing Street (MailingStreet)',
        MailingCity: 'Mailing City (MailingCity)',
        MailingState: 'Mailing State/Province (MailingState)',
        MailingPostalCode: 'Mailing Zip/Postal Code (MailingPostalCode)',
        MailingCountry: 'Mailing Country (MailingCountry)',
        Phone: 'Business Phone (Phone)',
        Fax: 'Business Fax (Fax)',
        MobilePhone: 'Mobile Phone (MobilePhone)',
        HomePhone: 'Home Phone (HomePhone)',
        OtherPhone: 'Other Phone (OtherPhone)',
        AssistantPhone: 'Asst. Phone (AssistantPhone)',
        ReportsToId: 'Reports To ID (ReportsToId)',
        Email: 'Email (Email)',
        Title: 'Title (Title)',
        Department: 'Department (Department)',
        AssistantName: "Assistant's Name (AssistantName)",
        LeadSource: 'Lead Source (LeadSource)',
        Birthdate: 'Birthdate (Birthdate)',
        Description: 'Contact Description (Description)',
        OwnerId: 'Owner ID (OwnerId)',
        CreatedDate: 'Created Date (CreatedDate)',
        CreatedById: 'Created By ID (CreatedById)',
        LastModifiedDate: 'Last Modified Date (LastModifiedDate)',
        LastModifiedById: 'Last Modified By ID (LastModifiedById)',
        SystemModstamp: 'System Modstamp (SystemModstamp)',
        LastActivityDate: 'Last Activity (LastActivityDate)',
        LastCURequestDate: 'Last Stay-in-Touch Request Date (LastCURequestDate)',
        LastCUUpdateDate: 'Last Stay-in-Touch Save Date (LastCUUpdateDate)',
        EmailBouncedReason: 'Email Bounced Reason (EmailBouncedReason)',
        EmailBouncedDate: 'Email Bounced Date (EmailBouncedDate)',
        Jigsaw: 'Data.com Key (Jigsaw)',
        JigsawContactId: 'Jigsaw Contact ID (JigsawContactId)',
        Level__c: 'Level (Level__c)',
        Languages__c: 'Languages (Languages__c)',
      });
    });
  });
});
