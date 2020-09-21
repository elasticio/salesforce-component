const TYPES_MAP = {
  address: 'address',
  anyType: 'string',
  base64: 'string',
  boolean: 'boolean',
  byte: 'string',
  calculated: 'string',
  combobox: 'string',
  currency: 'number',
  DataCategoryGroupReference: 'string',
  date: 'string',
  datetime: 'string',
  double: 'number',
  encryptedstring: 'string',
  email: 'string',
  id: 'string',
  int: 'number',
  JunctionIdList: 'JunctionIdList',
  location: 'location',
  masterrecord: 'string',
  multipicklist: 'multipicklist',
  percent: 'double',
  phone: 'string',
  picklist: 'string',
  reference: 'string',
  string: 'string',
  textarea: 'string',
  time: 'string',
  url: 'string',
};

const META_TYPES_MAP = {
  lookup: 'lookup',
  upsert: 'upsert',
  create: 'create',
  polling: 'polling',
};

/**
 * This method returns a property description for e.io proprietary schema
 *
 * @param field
 */
function createProperty(field) {
  let result = {};
  result.type = TYPES_MAP[field.type];
  if (!result.type) {
    throw new Error(
      `Can't convert type for type=${field.type} field=${JSON.stringify(
        field, null, ' ',
      )}`,
    );
  }
  if (field.type === 'textarea') {
    result.maxLength = 1000;
  } else if (field.type === 'picklist') {
    result.enum = field.picklistValues.filter((p) => p.active)
      .map((p) => p.value);
  } else if (field.type === 'multipicklist') {
    result = {
      type: 'array',
      items: {
        type: 'string',
        enum: field.picklistValues.filter((p) => p.active)
          .map((p) => p.value),
      },
    };
  } else if (field.type === 'JunctionIdList') {
    result = {
      type: 'array',
      items: {
        type: 'string',
      },
    };
  } else if (field.type === 'address') {
    result.type = 'object';
    result.properties = {
      city: { type: 'string' },
      country: { type: 'string' },
      postalCode: { type: 'string' },
      state: { type: 'string' },
      street: { type: 'string' },
    };
  } else if (field.type === 'location') {
    result.type = 'object';
    result.properties = {
      latitude: { type: 'string' },
      longitude: { type: 'string' },
    };
  }
  result.required = !field.nillable && !field.defaultedOnCreate;
  result.title = field.label;
  result.default = field.defaultValue;
  return result;
}

exports.processMeta = async function processMeta(meta, metaType, lookupField) {
  const result = {
    in: {
      type: 'object',
    },
    out: {
      type: 'object',
    },
  };
  result.in.properties = {};
  result.out.properties = {};
  const inProp = result.in.properties;
  const outProp = result.out.properties;
  let fields = await meta.fields.filter((field) => !field.deprecatedAndHidden);

  if (metaType === META_TYPES_MAP.create || metaType === META_TYPES_MAP.upsert) {
    fields = await fields.filter((field) => field.updateable && field.createable);
  }
  await fields.forEach((field) => {
    if (metaType === META_TYPES_MAP.lookup && field.name === lookupField) {
      inProp[field.name] = createProperty(field);
    } else if (metaType !== META_TYPES_MAP.lookup && field.createable) {
      inProp[field.name] = createProperty(field);
    }
    outProp[field.name] = createProperty(field);
  });
  if (metaType === META_TYPES_MAP.upsert) {
    Object.keys(inProp).forEach((key) => {
      inProp[key].required = false;
    });
    inProp.Id = {
      type: 'string',
      required: false,
      title: 'Id',
    };
  }
  if (metaType === META_TYPES_MAP.create) {
    outProp.id = {
      type: 'string',
      required: true,
    };
  }
  return result;
};

exports.getLookupFieldsModelWithTypeOfSearch = async function getLookupFieldsModelWithTypeOfSearch(meta, typeOfSearch) {
  const model = {};
  if (typeOfSearch === 'uniqueFields') {
    await meta.fields
      .filter((field) => field.type === 'id' || field.unique)
      .forEach((field) => {
        model[field.name] = `${field.label} (${field.name})`;
      });
  } else {
    await meta.fields
      .forEach((field) => {
        model[field.name] = `${field.label} (${field.name})`;
      });
  }
  return model;
};

exports.getLinkedObjectTypes = function getLinkedObjectTypes(meta) {
  const referenceFields = meta.fields.filter((field) => field.type === 'reference')
    .reduce((obj, field) => {
      if (!field.referenceTo.length) {
        throw new Error(
          `Empty referenceTo array for field of type 'reference' with name ${field.name} field=${JSON.stringify(
            field, null, ' ',
          )}`,
        );
      }
      if (field.relationshipName !== null) {
        // eslint-disable-next-line no-param-reassign
        obj[field.relationshipName] = `${field.referenceTo.join(', ')} (${field.relationshipName})`;
      }
      return obj;
    }, {});
  const childRelationships = meta.childRelationships
    .reduce((obj, child) => {
      if (child.relationshipName) {
        // add a '!' flag to distinguish between child and parent relationships,
        // will be popped off in lookupObject.processAction

        // eslint-disable-next-line no-param-reassign
        obj[`!${child.relationshipName}`] = `${child.childSObject} (${child.relationshipName})`;
      }
      return obj;
    }, {});
  return {
    ...referenceFields, ...childRelationships,
  };
};

module.exports.TYPES_MAP = TYPES_MAP;
module.exports.createProperty = createProperty;
