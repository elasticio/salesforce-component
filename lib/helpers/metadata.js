/**
 * Utility functions that transform Salesforce metadata to JSON Schema
 **/
var _ = require('lodash');

var FIELD_TYPE_TO_SCHEMA_TYPE = {
    "tns:ID": 'string',
    "xsd:boolean": 'boolean',
    "xsd:string": "string",
    "xsd:dateTime": "string",
    "xsd:double": "number",
    "xsd:int": "integer",
    "xsd:date": "string"
};

function _addEnum(field, result) {
    'use strict';
    var array = result.enum = [];
    _.each(field.picklistValues, function addValueToEnum(alternative) {
        array.push(alternative.value);
    });
}

function _fieldToProperty(field) {
    "use strict";
    var type = FIELD_TYPE_TO_SCHEMA_TYPE[field.soapType];
    if (!type) {
        throw new Error("Can't conver salesforce soapType " + field.soapType + " to JSON schema type");
    }
    var result = {
        type: FIELD_TYPE_TO_SCHEMA_TYPE[field.soapType],
        title: field.label,
        "default": field.defaultValue,
        required: !field.nillable,
        custom: field.custom,
        readonly: field.calculated || !field.updateable
    };
    if (field.type === "picklist") {
        _addEnum(field, result);
    }
    return result;
}

/**
 * We will filter out properties such as:
 * - Deprecated and Hidden
 * - If referenceTo is set
 * - If relationshipName is set
 * - Not creatable and not updatable
 *
 * @param field
 * @returns {*}
 * @private
 */
function _filterProperties(field) {
    if (field.name === 'Id' || field.name === 'ExtId__c') {
        return true;
    }
    if (field.deprecatedAndHidden) {
        return false;
    }
    if (field.referenceTo && field.referenceTo.length) {
        return false;
    }
    if (!field.updateable && !field.createable) {
        return false;
    }
    return true;
}

function buildSchemaFromDescription(objectDescription) {
    'use strict';
    var result = {
        description: objectDescription.name,
        type: "object",
        properties: {}
    };
    var filtered = _.filter(objectDescription.fields, _filterProperties);
    _.each(filtered, function addProperty(field) {
        var name = field.name;
        result.properties[name] = _fieldToProperty(field);
    });
    return result;
}

function pickSelectFields(metadata) {
    if (!metadata || !metadata.properties || _.isEqual({}, metadata.properties)) {
        throw new Error('No out metadata found to create select fields from');
    }

    return _.keys(metadata.properties).join(',');
}

/**
 * Exported converter function
 *
 * @param source
 * @return {Object}
 */
exports.buildSchemaFromDescription = buildSchemaFromDescription;
exports.pickSelectFields = pickSelectFields;
