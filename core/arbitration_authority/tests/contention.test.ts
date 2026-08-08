import { describe, expect, it } from 'vitest';
import { contestedResourceKey, detectContention } from '../src/contention.js';
import { makeRequest } from './testHelpers.js';

describe('IRAA contention detection', () => {
  it('groups two or more pending requests by their contested resource and sorts them stably', () => {
    const groups = detectContention([makeRequest({ requestId: 'b' }), makeRequest({ requestId: 'a' }), makeRequest({ requestId: 'cpu', resourceId: 'cpu-001' })]);
    expect(groups).toMatchObject([{ resourceKey: 'cpu-001', isContended: false }, { resourceKey: 'gpu-001', isContended: true, requests: [{ requestId: 'a' }, { requestId: 'b' }] }]);
  });
  it('does not select candidates: requests without IDs are visibly grouped by type evidence only', () => {
    expect(contestedResourceKey(makeRequest({ resourceId: undefined, resourceType: 'gpu' }))).toBe('resource-type:gpu');
  });
});
