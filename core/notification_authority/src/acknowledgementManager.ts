import type { Acknowledgement } from './types.js';

/** §12 — acknowledgement history is immutable, mirroring the structural
 * immutability of every other audit-style trail in this platform. */
export class AcknowledgementManager {
  private acknowledgements: Acknowledgement[] = [];

  record(acknowledgement: Acknowledgement): void {
    this.acknowledgements.push(Object.freeze({ ...acknowledgement }));
  }

  forNotification(notificationId: string): Acknowledgement[] {
    return this.acknowledgements.filter((entry) => entry.notificationId === notificationId);
  }

  isAcknowledged(notificationId: string): boolean {
    return this.acknowledgements.some((entry) => entry.notificationId === notificationId);
  }

  all(): readonly Acknowledgement[] {
    return this.acknowledgements;
  }
}
