import type { OwnershipRecord } from './types.js';
import { InvalidOwnershipError } from './errors.js';

export class OwnershipManager {
  private records = new Map<string, OwnershipRecord>();

  get(resourceId: string): OwnershipRecord | undefined {
    return this.records.get(resourceId);
  }

  require(resourceId: string): OwnershipRecord {
    const record = this.records.get(resourceId);
    if (!record) throw new InvalidOwnershipError(resourceId, `No ownership record for "${resourceId}".`);
    return record;
  }

  establish(resourceId: string, owner: string, acquiredAt: string, leaseExpiration?: string): OwnershipRecord {
    const record: OwnershipRecord = {
      resourceId,
      owner,
      acquiredAt,
      leaseExpiration,
      renewalHistory: [],
      releaseHistory: [],
    };
    this.records.set(resourceId, record);
    return record;
  }

  transfer(resourceId: string, newOwner: string, transferredAt: string, reason: string): OwnershipRecord {
    const existing = this.require(resourceId);
    const record: OwnershipRecord = {
      ...existing,
      owner: newOwner,
      acquiredAt: transferredAt,
      renewalHistory: [
        ...existing.renewalHistory,
        { renewedAt: transferredAt, reason: `Transferred: ${reason}` },
      ],
    };
    this.records.set(resourceId, record);
    return record;
  }

  renewLease(
    resourceId: string,
    renewedAt: string,
    newExpiration: string | undefined,
    reason: string,
  ): OwnershipRecord {
    const existing = this.require(resourceId);
    const record: OwnershipRecord = {
      ...existing,
      leaseExpiration: newExpiration,
      renewalHistory: [
        ...existing.renewalHistory,
        { renewedAt, newExpiration, reason },
      ],
    };
    this.records.set(resourceId, record);
    return record;
  }

  release(resourceId: string, releasedAt: string, reason: string, releasedBy: string): OwnershipRecord {
    const existing = this.require(resourceId);
    const record: OwnershipRecord = {
      ...existing,
      releaseHistory: [
        ...existing.releaseHistory,
        { releasedAt, reason, releasedBy },
      ],
    };
    this.records.set(resourceId, record);
    return record;
  }

  isLeaseExpired(resourceId: string, now: string): boolean {
    const record = this.records.get(resourceId);
    if (!record?.leaseExpiration) return false;
    return record.leaseExpiration <= now;
  }

  all(): OwnershipRecord[] {
    return [...this.records.values()].sort((a, b) => a.resourceId.localeCompare(b.resourceId));
  }
}
