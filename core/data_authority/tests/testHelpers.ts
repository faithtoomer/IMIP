import type { DomainSchema } from '../src/types.js';

export const WIDGET_SCHEMA: DomainSchema = {
  domain: 'benchmark-results',
  version: 1,
  fields: [
    { name: 'name', type: 'string', required: true, unique: true },
    { name: 'value', type: 'number', required: true },
    { name: 'active', type: 'boolean' },
    { name: 'secretNote', type: 'string', sensitive: true },
  ],
};
