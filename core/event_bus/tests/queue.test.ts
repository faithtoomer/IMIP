import { describe, expect, it } from 'vitest';
import { PriorityEventQueue } from '../src/queue.js';
import { QueueOverflowError } from '../src/errors.js';
import { makeEnvelope } from './testHelpers.js';

describe('PriorityEventQueue (§13/§19 — deterministic priority ordering)', () => {
  it('dequeues in priority order: critical > high > normal > low > background', () => {
    const queue = new PriorityEventQueue();
    queue.enqueue(makeEnvelope({ eventId: 'low', priority: 'low' }));
    queue.enqueue(makeEnvelope({ eventId: 'critical', priority: 'critical' }));
    queue.enqueue(makeEnvelope({ eventId: 'background', priority: 'background' }));
    queue.enqueue(makeEnvelope({ eventId: 'normal', priority: 'normal' }));
    queue.enqueue(makeEnvelope({ eventId: 'high', priority: 'high' }));

    const order: string[] = [];
    let item = queue.dequeue();
    while (item) {
      order.push(item.eventId);
      item = queue.dequeue();
    }
    expect(order).toEqual(['critical', 'high', 'normal', 'low', 'background']);
  });

  it('preserves FIFO order within the same priority tier (Law 4)', () => {
    const queue = new PriorityEventQueue();
    queue.enqueue(makeEnvelope({ eventId: 'a', priority: 'normal' }));
    queue.enqueue(makeEnvelope({ eventId: 'b', priority: 'normal' }));
    queue.enqueue(makeEnvelope({ eventId: 'c', priority: 'normal' }));

    const order: string[] = [];
    let item = queue.dequeue();
    while (item) {
      order.push(item.eventId);
      item = queue.dequeue();
    }
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('reports size correctly and returns undefined once empty', () => {
    const queue = new PriorityEventQueue();
    expect(queue.size).toBe(0);
    queue.enqueue(makeEnvelope());
    expect(queue.size).toBe(1);
    queue.dequeue();
    expect(queue.size).toBe(0);
    expect(queue.dequeue()).toBeUndefined();
  });

  it('throws QueueOverflowError once maxSize is exceeded (§16)', () => {
    const queue = new PriorityEventQueue(2);
    queue.enqueue(makeEnvelope({ eventId: 'a' }));
    queue.enqueue(makeEnvelope({ eventId: 'b' }));
    expect(() => queue.enqueue(makeEnvelope({ eventId: 'c' }))).toThrow(QueueOverflowError);
  });
});
