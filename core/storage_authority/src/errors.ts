import type { StorageDomain, StorageLifecycleStage } from './types.js';

export class StorageAuthorityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'StorageAuthorityError';
    this.code = code;
  }
}

export class UnknownStorageDomainError extends StorageAuthorityError {
  constructor(domain: string) {
    super('STORAGE_UNKNOWN_DOMAIN', `"${domain}" is not a recognized storage domain.`);
    this.name = 'UnknownStorageDomainError';
  }
}

export class DuplicateStorageIdError extends StorageAuthorityError {
  constructor(storageId: string) {
    super('STORAGE_DUPLICATE_ID', `Storage entry "${storageId}" is already registered.`);
    this.name = 'DuplicateStorageIdError';
  }
}

export class StorageNotFoundError extends StorageAuthorityError {
  constructor(storageId: string) {
    super('STORAGE_NOT_FOUND', `No storage entry "${storageId}" is registered.`);
    this.name = 'StorageNotFoundError';
  }
}

export class InvalidAllocationError extends StorageAuthorityError {
  constructor(domain: StorageDomain, purpose: string, reason: string) {
    super('STORAGE_INVALID_ALLOCATION', `Cannot allocate storage for "${domain}"/"${purpose}": ${reason}`);
    this.name = 'InvalidAllocationError';
  }
}

export class DirectoryMissingError extends StorageAuthorityError {
  constructor(path: string) {
    super('STORAGE_DIRECTORY_MISSING', `Managed storage path "${path}" does not exist on disk.`);
    this.name = 'DirectoryMissingError';
  }
}

export class InvalidStorageTransitionError extends StorageAuthorityError {
  constructor(from: StorageLifecycleStage, to: StorageLifecycleStage) {
    super('STORAGE_INVALID_TRANSITION', `Cannot transition a storage entry from "${from}" to "${to}".`);
    this.name = 'InvalidStorageTransitionError';
  }
}

export class ArchiveFailedError extends StorageAuthorityError {
  constructor(storageId: string, reason: string) {
    super('STORAGE_ARCHIVE_FAILED', `Failed to archive storage entry "${storageId}": ${reason}`);
    this.name = 'ArchiveFailedError';
  }
}

export class CleanupFailedError extends StorageAuthorityError {
  constructor(storageId: string, reason: string) {
    super('STORAGE_CLEANUP_FAILED', `Failed to clean up storage entry "${storageId}": ${reason}`);
    this.name = 'CleanupFailedError';
  }
}
