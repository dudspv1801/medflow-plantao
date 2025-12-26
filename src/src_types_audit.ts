// Type-safe audit types used both on client and server

export type ActionType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditChanges {
  // Map of changed fields to { before, after } (both may be any JSON-serializable value)
  [field: string]: {
    before: unknown;
    after: unknown;
  };
}

export interface AuditMetadata {
  ip?: string; // populated server-side
  userAgent?: string; // populated server-side
  // any other metadata you want
  [key: string]: unknown;
}

export interface AuditLogInput {
  timestamp?: string; // optional from client; server will use its own timestamp if not provided
  userId: string;
  actionType: ActionType;
  resourceType?: string; // e.g., "medical_record"
  resourceId: string;
  changes: AuditChanges;
  metadata?: Partial<AuditMetadata>; // client may include limited metadata but server should augment/overwrite ip/userAgent
  // optional client-side computedSignature or clientHash can be included, but server is authoritative
}

export interface AuditLog extends AuditLogInput {
  id: string; // uuid
  timestamp: string; // ISO UTC string (server set)
  prevHash?: string | null; // for chaining per-resource or global
  hash: string; // SHA-256 hex of canonicalized payload that covers the fields below
  signature: string; // server signature (e.g. RSA-SHA256 base64) of the hash or canonical json
  keyId?: string; // which signing key was used (for rotation)
}