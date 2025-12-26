// Next.js API route example (pages/api/audit.ts). Adjust to your /app routing if needed.
// Responsibilities:
// - Authenticate request (example placeholder).
// - Build canonical payload server-side.
// - Compute hash (sha256) and link prevHash per resource (optional).
// - Sign with private key (recommended).
// - Store via Prisma into an append-only AuditLog table.

import type { NextApiRequest, NextApiResponse } from 'next';
import { AuditLogInput } from '../../src/types/audit';
import { canonicalizeForHash, sha256HexNode, signWithPrivateKey } from '../../src/server/crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getAuthenticatedUserId(req: NextApiRequest): Promise<string | null> {
  // Replace with your auth verification (cookie/session/bearer token).
  // Example: read Authorization header and verify JWT -> return userId
  // For this example, we accept an "x-user-id" header (DO NOT do this in production).
  const uid = req.headers['x-user-id'] as string | undefined;
  return uid ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const userId = await getAuthenticatedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { payload, clientHash } = req.body as { payload: AuditLogInput; clientHash?: string };

  if (!payload || !payload.resourceId || !payload.actionType || !payload.changes) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // Build server-side canonical payload (explicit ordering)
  const timestamp = new Date().toISOString();
  const serverPayload = {
    userId,
    actionType: payload.actionType,
    resourceType: payload.resourceType ?? null,
    resourceId: payload.resourceId,
    changes: payload.changes,
    metadata: {
      ...payload.metadata,
      // populate server-side metadata
      ip: (req.headers['x-forwarded-for'] as string | undefined) ?? req.socket.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    },
    timestamp,
  };

  // Canonicalize and compute hash
  const canonical = canonicalizeForHash(serverPayload);
  const hash = sha256HexNode(canonical);

  // Optionally: get prevHash for the resource to chain entries (resource-level chain)
  const prev = await prisma.auditLog.findFirst({
    where: { resourceId: payload.resourceId },
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  });
  const prevHash = prev?.hash ?? null;

  // Sign the canonical string (or the hash) with server private key
  // Better: use KMS to sign (recommended). Here we use a PEM private key from env (EXAMPLE ONLY)
  const PRIVATE_KEY_PEM = process.env.AUDIT_PRIVATE_KEY_PEM || ''; // load securely
  let signature = '';
  let keyId: string | undefined = process.env.AUDIT_KEY_ID;
  if (PRIVATE_KEY_PEM) {
    signature = signWithPrivateKey(PRIVATE_KEY_PEM, canonical);
  } else {
    // Fallback: use HMAC with secret (LESS SECURE)
    const HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || 'dev-secret';
    signature = Buffer.from(require('crypto').createHmac('sha256', HMAC_SECRET).update(canonical).digest('hex')).toString('base64');
    keyId = keyId ?? 'hmac-dev';
  }

  // Store audit log (append-only). Prisma model below.
  try {
    const created = await prisma.auditLog.create({
      data: {
        userId,
        actionType: payload.actionType,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        changes: payload.changes as any,
        metadata: serverPayload.metadata as any,
        timestamp: new Date(timestamp),
        hash,
        prevHash,
        signature,
        keyId,
      },
    });
    return res.status(201).json({ ok: true, id: created.id });
  } catch (err) {
    console.error('Audit storage error', err);
    return res.status(500).json({ error: 'Could not store audit' });
  }
}