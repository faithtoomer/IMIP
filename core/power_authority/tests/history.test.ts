import { describe, expect, it } from 'vitest';
import { PowerHistoryStore } from '../src/history.js';
import { createTestAuthority, registerGpu } from './testHelpers.js';
import { synthesizeSample } from '../src/telemetry.js';

describe('PowerHistoryStore', () => {
  it('append() stores history points', () => {
    const store = new PowerHistoryStore();
    store.append({ deviceId: 'gpu-1', watts: 200, timestamp: '2026-08-08T10:00:00Z' });
    expect(store.count()).toBe(1);
  });

  it('query() filters by deviceId', () => {
    const store = new PowerHistoryStore();
    store.append({ deviceId: 'gpu-1', watts: 200, timestamp: '2026-08-08T10:00:00Z' });
    store.append({ deviceId: 'cpu-1', watts: 65, timestamp: '2026-08-08T10:00:00Z' });
    expect(store.query({ deviceId: 'gpu-1' })).toHaveLength(1);
  });

  it('query() filters by time range', () => {
    const store = new PowerHistoryStore();
    store.append({ deviceId: 'gpu-1', watts: 200, timestamp: '2026-08-08T10:00:00Z' });
    store.append({ deviceId: 'gpu-1', watts: 210, timestamp: '2026-08-08T11:00:00Z' });
    store.append({ deviceId: 'gpu-1', watts: 220, timestamp: '2026-08-08T12:00:00Z' });
    const results = store.query({ deviceId: 'gpu-1', from: '2026-08-08T10:30:00Z', to: '2026-08-08T11:30:00Z' });
    expect(results).toHaveLength(1);
    expect(results[0].watts).toBe(210);
  });

  it('forDevice() returns sorted history', () => {
    const store = new PowerHistoryStore();
    store.append({ deviceId: 'gpu-1', watts: 220, timestamp: '2026-08-08T12:00:00Z' });
    store.append({ deviceId: 'gpu-1', watts: 200, timestamp: '2026-08-08T10:00:00Z' });
    const results = store.forDevice('gpu-1');
    expect(results[0].watts).toBe(200);
    expect(results[1].watts).toBe(220);
  });
});

describe('PowerAuthority history', () => {
  it('collectAndUpdate appends to history', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority);
    telemetry.setSamples([synthesizeSample('gpu-1', 200)]);
    await authority.collectAndUpdate();
    expect(authority.getHistory('gpu-1')).toHaveLength(1);
  });

  it('multiple samples accumulate history', async () => {
    const { authority, telemetry } = createTestAuthority();
    registerGpu(authority);
    telemetry.setSamples([
      synthesizeSample('gpu-1', 200, { timestamp: '2026-08-08T10:00:00Z' }),
    ]);
    await authority.collectAndUpdate();
    telemetry.setSamples([
      synthesizeSample('gpu-1', 220, { timestamp: '2026-08-08T11:00:00Z' }),
    ]);
    await authority.collectAndUpdate();
    expect(authority.getHistory('gpu-1')).toHaveLength(2);
  });
});
