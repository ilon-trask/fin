// Conflicts are safe to return to clients; unexpected failures stay server-side.
export class SyncConflictError extends Error {}
