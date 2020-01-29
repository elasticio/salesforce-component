const chai = require('chai');

const { expect } = chai;
const metadata = require('../../lib/helpers/metadata');
const description = require('../testData/objectDescriptionForMetadata');
const expectedInputMetadata = require('../testData/expectedMetadataIn');
const expectedOutputMetadata = require('../testData/expectedMetadataOut');

describe('Metadata to select fields conversion', () => {
  describe('Test pickSelectFields', () => {
    it('should convert metadata out properties to a comma separated string value', () => {
      const input = {
        description: 'Contact',
        type: 'object',
        properties: {
          LastName: {},
          FirstName: {},
          Jigsaw: {},
          Level__c: {},
          Languages__c: {},
        },
      };

      const result = metadata.pickSelectFields(input);
      expect(result).to.equal('LastName,FirstName,Jigsaw,Level__c,Languages__c');
    });

    it('should throw an exception if metadata.out doesn\'t exist', () => {
      expect(() => {
        metadata.pickSelectFields({});
      }).to.throw('No out metadata found to create select fields from');
    });
  });

  describe('Test buildSchemaFromDescription', () => {
    it('should buildSchemaFromDescription for input metadata', () => {
      const result = metadata.buildSchemaFromDescription(description, 'in');
      expect(result).to.deep.equal(expectedInputMetadata);
    });

    it('should buildSchemaFromDescription for output metadata', () => {
      const result = metadata.buildSchemaFromDescription(description, 'out');
      expect(result).to.deep.equal(expectedOutputMetadata);
    });
  });
});
