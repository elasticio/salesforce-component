const { expect } = require('chai');
const { processMeta } = require('../../lib/helpers/utils');
const contactDescription = require('../testData/objectDescription.json');

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
});
