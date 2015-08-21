var _ = require('underscore');

function metadataToSelectFields (params) {

    var metadata = params.metadata;

    if (!metadata || !metadata.properties || _.isEqual({}, metadata.properties)) {
        throw new Error('No out metadata found to create select fields from');
    }

    var selectFields = _.keys(metadata.properties).join(',');

    params.selectFields = selectFields;

    return params;

};

module.exports = metadataToSelectFields;
