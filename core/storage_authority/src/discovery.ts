import * as si from 'systeminformation';
import type { DiscoveredVolume } from './types.js';

/** §9 — real, whole-machine storage discovery via `systeminformation`
 * (already a platform dependency — IHIS uses it for real hardware discovery,
 * Phase 03). Enumerates every mounted filesystem, cross-platform. */
export async function discoverVolumes(): Promise<DiscoveredVolume[]> {
  const filesystems = await si.fsSize();
  return filesystems.map((fs) => ({
    mount: fs.mount,
    type: fs.type,
    totalBytes: fs.size,
    usedBytes: fs.used,
    availableBytes: fs.available,
    usedPercent: fs.use,
  }));
}
