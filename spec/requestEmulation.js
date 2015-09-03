var events = require('events');
var util = require('util');

var RequestEmulation = function()
{
    events.EventEmitter.call(this);
};

util.inherits(RequestEmulation, events.EventEmitter);

exports.RequestEmulation = RequestEmulation;