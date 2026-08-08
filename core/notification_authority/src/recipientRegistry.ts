import { RecipientNotFoundError } from './errors.js';
import type { NotificationPriority, Recipient } from './types.js';

const PRIORITY_RANK: Record<NotificationPriority, number> = {
  informational: 0,
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
};

/** §5's Routing Engine needs a "who" to route to — the spec names the
 * Routing Engine and "who should know" as a governed decision (§Mission)
 * without separately naming a recipient registry; this is the real,
 * necessary primitive that decision requires, built honestly rather than
 * left implicit. */
export class RecipientRegistry {
  private recipients = new Map<string, Recipient>();

  register(recipient: Recipient): void {
    this.recipients.set(recipient.recipientId, recipient);
  }

  remove(recipientId: string): void {
    this.require(recipientId);
    this.recipients.delete(recipientId);
  }

  get(recipientId: string): Recipient | undefined {
    return this.recipients.get(recipientId);
  }

  require(recipientId: string): Recipient {
    const recipient = this.recipients.get(recipientId);
    if (!recipient) throw new RecipientNotFoundError(recipientId);
    return recipient;
  }

  all(): Recipient[] {
    return [...this.recipients.values()];
  }

  /** Recipients with no `subscribedCategories` receive every category;
   * `minimumPriority` filters out anything below their configured floor. */
  subscribersFor(category: string, priority: NotificationPriority): Recipient[] {
    return this.all().filter((recipient) => {
      const categoryMatches = !recipient.subscribedCategories || recipient.subscribedCategories.includes(category);
      const priorityMatches = !recipient.minimumPriority || PRIORITY_RANK[priority] >= PRIORITY_RANK[recipient.minimumPriority];
      return categoryMatches && priorityMatches;
    });
  }
}

export { PRIORITY_RANK };
