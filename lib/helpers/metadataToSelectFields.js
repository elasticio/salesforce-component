var _ = require('underscore');

function metadataToSelectFields(metadata) {
    if (!metadata || !metadata.properties || _.isEqual({}, metadata.properties)) {
        throw new Error('No out metadata found to create select fields from');
    }

    var selectFields = _.keys(metadata.properties).join(',');
    return selectFields;
}

module.exports = metadataToSelectFields;
