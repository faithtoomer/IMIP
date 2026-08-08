import { DuplicateNotificationTypeError, UnregisteredNotificationTypeError } from './errors.js';
import type { NotificationDefinition } from './types.js';

/** §8 — the authoritative registry of notification *types* (distinct from
 * individual notification instances, tracked elsewhere). */
export class NotificationRegistry {
  private definitions = new Map<string, NotificationDefinition>();

  register(definition: NotificationDefinition): void {
    if (this.definitions.has(definition.notificationTypeId)) {
      throw new DuplicateNotificationTypeError(definition.notificationTypeId);
    }
    this.definitions.set(definition.notificationTypeId, definition);
  }

  get(notificationTypeId: string): NotificationDefinition | undefined {
    return this.definitions.get(notificationTypeId);
  }

  require(notificationTypeId: string): NotificationDefinition {
    const definition = this.definitions.get(notificationTypeId);
    if (!definition) throw new UnregisteredNotificationTypeError(notificationTypeId);
    return definition;
  }

  byTriggerEvent(eventName: string): NotificationDefinition[] {
    return [...this.definitions.values()].filter((definition) => definition.triggerEvent === eventName);
  }

  all(): NotificationDefinition[] {
    return [...this.definitions.values()];
  }
}
