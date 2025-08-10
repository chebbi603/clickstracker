const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, removeAdditional: 'all' });
addFormats(ajv);

const eventSchema = {
  type: 'object',
  properties: {
    sessionId: { type: 'string', minLength: 1 },
    pageUrl: { type: 'string', minLength: 1 },
    eventType: { type: 'string', enum: ['click', 'scroll'] },
    elementSelector: { type: ['string', 'null'] },
    clickX: { type: ['number', 'null'] },
    clickY: { type: ['number', 'null'] },
    scrollDepth: { type: ['number', 'null'] },
    timestamp: { type: 'number' }
  },
  required: ['sessionId', 'pageUrl', 'eventType', 'timestamp'],
  additionalProperties: false
};

const batchSchema = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      minItems: 1,
      items: eventSchema
    }
  },
  required: ['events'],
  additionalProperties: false
};

const validateBatch = ajv.compile(batchSchema);

module.exports = { validateBatch, eventSchema, batchSchema };