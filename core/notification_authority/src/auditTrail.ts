import type { NotificationRecord } from './types.js';

/** §9's lifecycle transitions are auditable; this is the structurally
 * immutable record of every one of them, mirroring DataAuditTrail (Phase
 * 08), AuditLogTrail (Phase 10), and SecurityAuditTrail (Phase 12): no
 * update or delete method is exposed, for any reason. */
export class NotificationAuditTrail {
  private snapshots: NotificationRecord[] = [];

  record(notification: NotificationRecord): void {
    this.snapshots.push(Object.freeze({ ...notification, deliveries: [...notification.deliveries] }));
  }

  all(): readonly NotificationRecord[] {
    return this.snapshots;
  }

  history(notificationId: string): NotificationRecord[] {
    return this.snapshots.filter((snapshot) => snapshot.notificationId === notificationId);
  }
}
