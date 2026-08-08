import { randomUUID } from 'node:crypto';
import type { StorageProvider } from './storageProvider.js';

/**
 * §8 — atomic transactions with nested-transaction support via SQL SAVEPOINTs
 * (real nesting, not simulated): the outermost call does BEGIN/COMMIT/
 * ROLLBACK; any call nested inside an already-open transaction uses a
 * SAVEPOINT instead, so an inner failure can roll back just its own work
 * without aborting the outer transaction.
 */
export class TransactionManager {
  private depth = 0;
  private currentTransactionId?: string;

  constructor(private readonly storage: StorageProvider) {}

  get activeTransactionId(): string | undefined {
    return this.currentTransactionId;
  }

  runInTransaction<T>(fn: () => T): { result: T; transactionId: string } {
    const isOuter = this.depth === 0;
    const transactionId = isOuter ? randomUUID() : this.currentTransactionId!;
    const savepointName = `sp_${this.depth}`;

    if (isOuter) {
      this.storage.beginTransaction();
      this.currentTransactionId = transactionId;
    } else {
      this.storage.savepoint(savepointName);
    }
    this.depth += 1;

    try {
      const result = fn();
      this.depth -= 1;
      if (isOuter) {
        this.storage.commitTransaction();
        this.currentTransactionId = undefined;
      } else {
        this.storage.releaseSavepoint(savepointName);
      }
      return { result, transactionId };
    } catch (error) {
      this.depth -= 1;
      if (isOuter) {
        this.storage.rollbackTransaction();
        this.currentTransactionId = undefined;
      } else {
        this.storage.rollbackToSavepoint(savepointName);
      }
      throw error;
    }
  }
}
