describe('Metadata to select fields conversion', function () {

    var metadata = require('../../lib/helpers/metadata');

    it('should convert metadata out properties to a comma separated string value', function () {

        var input = {
            description: 'Contact',
            type: 'object',
            properties: { LastName: {},
                FirstName: {},
                Salutation: {},
                OtherStreet: {},
                OtherCity: {},
                OtherState: {},
                OtherPostalCode: {},
                OtherCountry: {},
                MailingStreet: {},
                MailingCity: {},
                MailingState: {},
                MailingPostalCode: {},
                MailingCountry: {},
                Phone: {},
                Fax: {},
                MobilePhone: {},
                HomePhone: {},
                OtherPhone: {},
                AssistantPhone: {},
                Email: {},
                Title: {},
                Department: {},
                AssistantName: {},
                LeadSource: {},
                Birthdate: {},
                Description: {},
                EmailBouncedReason: {},
                EmailBouncedDate: {},
                Jigsaw: {},
                Level__c: {},
                Languages__c: {}
            }
        };

        var result = metadata.pickSelectFields(input);
        expect(result).toEqual("LastName,FirstName,Salutation,OtherStreet,OtherCity,OtherState,OtherPostalCode,OtherCountry,MailingStreet,MailingCity,MailingState,MailingPostalCode,MailingCountry,Phone,Fax,MobilePhone,HomePhone,OtherPhone,AssistantPhone,Email,Title,Department,AssistantName,LeadSource,Birthdate,Description,EmailBouncedReason,EmailBouncedDate,Jigsaw,Level__c,Languages__c");
    });

    it('should throw an exception if metadata.out doesn\'t exist', function () {

        expect(function () {
            metadata.pickSelectFields({});
        }).toThrow(new Error('No out metadata found to create select fields from'));

    });
});