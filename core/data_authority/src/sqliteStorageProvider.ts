import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { existsSync, statSync } from 'node:fs';
import type { StorageProvider } from './storageProvider.js';
import type {
  BackupValidationResult,
  DataDomain,
  DataRecord,
  DomainSchema,
  QueryOperator,
  QueryOptions,
  RelationshipRecord,
} from './types.js';
import { BackupFailedError, InvalidQueryFieldError } from './errors.js';

const OPERATOR_SQL: Record<QueryOperator, string> = {
  eq: '=',
  ne: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  contains: 'LIKE',
};

const FIELD_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/** Governance fields live in real columns, not inside the opaque `data` JSON
 * blob — queries/sorts on them must target the column directly rather than
 * going through `json_extract`, or they'd silently match nothing. */
const GOVERNANCE_COLUMNS: Record<string, string> = {
  id: 'id',
  version: 'version',
  revision: 'revision',
  lifecycleStage: 'lifecycle_stage',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

function resolveColumn(field: string): string {
  const governanceColumn = GOVERNANCE_COLUMNS[field];
  if (governanceColumn) return governanceColumn;
  if (!FIELD_NAME_PATTERN.test(field)) throw new InvalidQueryFieldError(field);
  return `json_extract(data, '$.${field}')`;
}

function tableName(domain: DataDomain): string {
  return `domain_${domain.replace(/-/g, '_')}`;
}

function rowToRecord(row: Record<string, unknown>): DataRecord {
  return {
    id: row.id as string,
    domain: row.domain as DataDomain,
    data: JSON.parse(row.data as string) as Record<string, unknown>,
    version: row.version as number,
    revision: row.revision as number,
    lifecycleStage: row.lifecycle_stage as DataRecord['lifecycleStage'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * §5/§7 — the real, default StorageProvider, backed by Node's built-in
 * `node:sqlite` (no external dependency needed; verified working on the
 * target Node runtime). Every persisted record is stored as an opaque JSON
 * blob alongside governance columns (id/version/lifecycle/timestamps),
 * queried via SQLite's built-in JSON1 `json_extract` — this is the one file
 * in IDA allowed to contain SQL (Law 2 / §7).
 */
export class SqliteStorageProvider implements StorageProvider {
  private db: DatabaseSync;

  constructor(private readonly filePath: string = ':memory:') {
    this.db = new DatabaseSync(filePath);
  }

  ensureDomainTable(schema: DomainSchema): void {
    const table = tableName(schema.domain);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS "${table}" (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        version INTEGER NOT NULL,
        revision INTEGER NOT NULL,
        lifecycle_stage TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  ensureRelationshipsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relationships (
        relationship_id TEXT PRIMARY KEY,
        from_domain TEXT NOT NULL,
        from_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        to_domain TEXT NOT NULL,
        to_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_rel_from ON relationships (from_domain, from_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_rel_to ON relationships (to_domain, to_id)`);
  }

  insert(domain: DataDomain, record: DataRecord): void {
    const table = tableName(domain);
    this.db
      .prepare(
        `INSERT INTO "${table}" (id, data, version, revision, lifecycle_stage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        JSON.stringify(record.data),
        record.version,
        record.revision,
        record.lifecycleStage,
        record.createdAt,
        record.updatedAt,
      );
  }

  update(domain: DataDomain, id: string, record: DataRecord): void {
    const table = tableName(domain);
    this.db
      .prepare(`UPDATE "${table}" SET data = ?, version = ?, revision = ?, lifecycle_stage = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(record.data), record.version, record.revision, record.lifecycleStage, record.updatedAt, id);
  }

  delete(domain: DataDomain, id: string): void {
    const table = tableName(domain);
    this.db.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(id);
  }

  get(domain: DataDomain, id: string): DataRecord | undefined {
    const table = tableName(domain);
    const row = this.db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return row ? { ...rowToRecord(row), domain } : undefined;
  }

  find(domain: DataDomain, options: QueryOptions): DataRecord[] {
    const table = tableName(domain);
    const { whereSql, params } = this.buildWhere(options);
    let sql = `SELECT * FROM "${table}" ${whereSql}`;
    if (options.sortBy) {
      sql += ` ORDER BY ${resolveColumn(options.sortBy)} ${options.sortDirection === 'desc' ? 'DESC' : 'ASC'}`;
    }
    if (typeof options.limit === 'number') sql += ` LIMIT ${Math.max(0, Math.floor(options.limit))}`;
    if (typeof options.offset === 'number') sql += ` OFFSET ${Math.max(0, Math.floor(options.offset))}`;

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((row) => ({ ...rowToRecord(row), domain }));
  }

  count(domain: DataDomain, options: QueryOptions = {}): number {
    const table = tableName(domain);
    const { whereSql, params } = this.buildWhere(options);
    const row = this.db.prepare(`SELECT COUNT(*) as c FROM "${table}" ${whereSql}`).get(...params) as { c: number };
    return row.c;
  }

  exists(domain: DataDomain, id: string): boolean {
    return this.get(domain, id) !== undefined;
  }

  beginTransaction(): void {
    this.db.exec('BEGIN');
  }

  commitTransaction(): void {
    this.db.exec('COMMIT');
  }

  rollbackTransaction(): void {
    this.db.exec('ROLLBACK');
  }

  savepoint(name: string): void {
    this.db.exec(`SAVEPOINT ${name}`);
  }

  releaseSavepoint(name: string): void {
    this.db.exec(`RELEASE SAVEPOINT ${name}`);
  }

  rollbackToSavepoint(name: string): void {
    this.db.exec(`ROLLBACK TO SAVEPOINT ${name}`);
  }

  insertRelationship(record: RelationshipRecord): void {
    this.db
      .prepare(
        `INSERT INTO relationships (relationship_id, from_domain, from_id, relationship_type, to_domain, to_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(record.relationshipId, record.fromDomain, record.fromId, record.relationshipType, record.toDomain, record.toId, record.createdAt);
  }

  findRelationshipsFrom(fromDomain: DataDomain, fromId: string, relationshipType?: string): RelationshipRecord[] {
    return this.queryRelationships('from_domain', fromDomain, 'from_id', fromId, relationshipType);
  }

  findRelationshipsTo(toDomain: DataDomain, toId: string, relationshipType?: string): RelationshipRecord[] {
    return this.queryRelationships('to_domain', toDomain, 'to_id', toId, relationshipType);
  }

  private queryRelationships(
    domainCol: string,
    domainValue: string,
    idCol: string,
    idValue: string,
    relationshipType?: string,
  ): RelationshipRecord[] {
    let sql = `SELECT * FROM relationships WHERE ${domainCol} = ? AND ${idCol} = ?`;
    const params: SQLInputValue[] = [domainValue, idValue];
    if (relationshipType) {
      sql += ' AND relationship_type = ?';
      params.push(relationshipType);
    }
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((row) => ({
      relationshipId: row.relationship_id as string,
      fromDomain: row.from_domain as DataDomain,
      fromId: row.from_id as string,
      relationshipType: row.relationship_type as string,
      toDomain: row.to_domain as DataDomain,
      toId: row.to_id as string,
      createdAt: row.created_at as string,
    }));
  }

  backup(destinationPath: string): void {
    try {
      this.db.exec(`VACUUM INTO '${destinationPath.replace(/'/g, "''")}'`);
    } catch (error) {
      throw new BackupFailedError((error as Error).message);
    }
  }

  validateBackup(path: string): BackupValidationResult {
    if (!existsSync(path)) return { valid: false, reasons: [`"${path}" does not exist.`] };
    try {
      const check = new DatabaseSync(path);
      const result = check.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      check.close();
      return result.integrity_check === 'ok' ? { valid: true, reasons: [] } : { valid: false, reasons: [result.integrity_check] };
    } catch (error) {
      return { valid: false, reasons: [(error as Error).message] };
    }
  }

  getSizeBytes(): number {
    if (this.filePath === ':memory:' || !existsSync(this.filePath)) return 0;
    return statSync(this.filePath).size;
  }

  close(): void {
    this.db.close();
  }

  private buildWhere(options: QueryOptions): { whereSql: string; params: SQLInputValue[] } {
    if (!options.filters || options.filters.length === 0) return { whereSql: '', params: [] };
    const clauses: string[] = [];
    const params: SQLInputValue[] = [];
    for (const filter of options.filters) {
      const column = resolveColumn(filter.field);
      if (filter.op === 'contains') {
        clauses.push(`${column} LIKE ?`);
        params.push(`%${String(filter.value)}%`);
      } else {
        clauses.push(`${column} ${OPERATOR_SQL[filter.op]} ?`);
        params.push(toSqlValue(filter.value));
      }
    }
    return { whereSql: `WHERE ${clauses.join(' AND ')}`, params };
  }
}

/** json_extract() returns SQLite's native 0/1 for JSON booleans, so filter
 * values must be coerced the same way — SQLInputValue has no boolean member. */
function toSqlValue(value: unknown): SQLInputValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === null || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'string') return value;
  return JSON.stringify(value);
}
