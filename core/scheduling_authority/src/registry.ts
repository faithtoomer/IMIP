import { DuplicateScheduleError, ScheduleNotFoundError } from './errors.js';
import type { ScheduleDefinition } from './types.js';

/** §7 — the authoritative Schedule Registry. Mirrors the SSOT pattern used
 * by every other registry in this platform. */
export class ScheduleRegistry {
  private schedules = new Map<string, ScheduleDefinition>();

  register(schedule: ScheduleDefinition): void {
    if (this.schedules.has(schedule.scheduleId)) throw new DuplicateScheduleError(schedule.scheduleId);
    this.schedules.set(schedule.scheduleId, schedule);
  }

  update(schedule: ScheduleDefinition): void {
    this.require(schedule.scheduleId);
    this.schedules.set(schedule.scheduleId, schedule);
  }

  remove(scheduleId: string): void {
    this.require(scheduleId);
    this.schedules.delete(scheduleId);
  }

  get(scheduleId: string): ScheduleDefinition | undefined {
    return this.schedules.get(scheduleId);
  }

  require(scheduleId: string): ScheduleDefinition {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) throw new ScheduleNotFoundError(scheduleId);
    return schedule;
  }

  byOwner(ownerAuthority: string): ScheduleDefinition[] {
    return [...this.schedules.values()].filter((schedule) => schedule.ownerAuthority === ownerAuthority);
  }

  all(): ScheduleDefinition[] {
    return [...this.schedules.values()];
  }
}
