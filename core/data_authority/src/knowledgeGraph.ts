import { randomUUID } from 'node:crypto';
import type { StorageProvider } from './storageProvider.js';
import type { DataDomain, RelationshipRecord } from './types.js';

/**
 * §22 — Architect's Enhancement: the Institutional Knowledge Model (IKM).
 * A typed, bidirectionally-queryable graph of relationships between entities,
 * possibly across domains (Hardware ↔ Capabilities, Benchmarks ↔ Hardware
 * Profiles, etc.). Generic by design — like IRBLM's dependency graph, it
 * doesn't hardcode the specific relationship types the spec names as
 * examples; any two entities in any two domains can be linked, so the graph
 * is ready for Decisions ↔ Explainability, Mining Sessions ↔ Profitability,
 * and every other pairing the moment those domains have real data.
 */
export class KnowledgeGraph {
  constructor(private readonly storage: StorageProvider) {
    this.storage.ensureRelationshipsTable();
  }

  link(fromDomain: DataDomain, fromId: string, relationshipType: string, toDomain: DataDomain, toId: string): RelationshipRecord {
    const record: RelationshipRecord = {
      relationshipId: randomUUID(),
      fromDomain,
      fromId,
      relationshipType,
      toDomain,
      toId,
      createdAt: new Date().toISOString(),
    };
    this.storage.insertRelationship(record);
    return record;
  }

  relatedFrom(fromDomain: DataDomain, fromId: string, relationshipType?: string): RelationshipRecord[] {
    return this.storage.findRelationshipsFrom(fromDomain, fromId, relationshipType);
  }

  relatedTo(toDomain: DataDomain, toId: string, relationshipType?: string): RelationshipRecord[] {
    return this.storage.findRelationshipsTo(toDomain, toId, relationshipType);
  }
}
