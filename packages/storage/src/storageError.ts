export class StorageError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = 'StorageError';
  }
}

export function toStorageError(message: string): (cause: unknown) => StorageError {
  return (cause) => (cause instanceof StorageError ? cause : new StorageError(message, { cause }));
}
