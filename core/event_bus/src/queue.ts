import type { EventEnvelope, EventPriority } from './types.js';
import { QueueOverflowError } from './errors.js';

const PRIORITY_RANK: Record<EventPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
  background: 4,
};

interface QueueItem {
  envelope: EventEnvelope;
  rank: number;
  sequence: number;
}

/**
 * §13/§19 — binary min-heap keyed by (priority rank, insertion sequence), so
 * higher-priority events dispatch first, and same-priority events preserve
 * insertion order (Law 4 — deterministic, documented ordering).
 */
export class PriorityEventQueue {
  private heap: QueueItem[] = [];
  private sequenceCounter = 0;

  constructor(private readonly maxSize = 10_000) {}

  get size(): number {
    return this.heap.length;
  }

  enqueue(envelope: EventEnvelope): void {
    if (this.heap.length >= this.maxSize) {
      throw new QueueOverflowError(this.maxSize);
    }
    this.sequenceCounter += 1;
    const item: QueueItem = { envelope, rank: PRIORITY_RANK[envelope.priority], sequence: this.sequenceCounter };
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): EventEnvelope | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top.envelope;
  }

  private compare(a: QueueItem, b: QueueItem): number {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.sequence - b.sequence;
  }

  private bubbleUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.compare(this.heap[i], this.heap[parent]) >= 0) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
      i = parent;
    }
  }

  private bubbleDown(index: number): void {
    let i = index;
    for (;;) {
      const left = i * 2 + 1;
      const right = i * 2 + 2;
      let smallest = i;
      if (left < this.heap.length && this.compare(this.heap[left], this.heap[smallest]) < 0) smallest = left;
      if (right < this.heap.length && this.compare(this.heap[right], this.heap[smallest]) < 0) smallest = right;
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
      i = smallest;
    }
  }
}
