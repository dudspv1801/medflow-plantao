// src/types/audit.ts
export type ActionType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditChanges {
  // Map field -> { before, after } (JSON-serializable)
  [field: string]: {
    before: unknown;
    after: unknown;
  };
}

export interface AuditMetadata {
  ip?: string | null;
  userAgent?: string | null;
  [key: string]: unknown;
}

export interface AuditLogInput {
  // client can set timestamp optionally, but server will use its own authoritative timestamp
  timestamp?: string;
  userId: string;
  actionType: ActionType;
  resourceType?: string;
  resourceId: string;
  changes: AuditChanges;
  metadata?: Partial<AuditMetadata>;
}

export interface AuditLog extends AuditLogInput {
  id: string;
  timestamp: string; // ISO UTC
  prevHash?: string | null;
  hash: string; // SHA-256 hex of canonical payload
  signature: string; // base64 signature (or base64 of HMAC hex)
  keyId?: string;
}
