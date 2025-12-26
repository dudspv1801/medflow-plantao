import type { NextApiRequest, NextApiResponse } from 'next';
import type { AuditLogInput, AuditLog } from '../../types/audit';
import { canonicalizeForHash, sha256HexNode, signWithPrivateKey } from '../../server/crypto';
import admin from 'firebase-admin';

/**
 * Initialize Firebase Admin once (server only)
 * Expect FIREBASE_SERVICE_ACCOUNT_JSON to contain the JSON-service-account payload.
 */
function initFirebaseAdmin() {
  if (admin.apps.length) return;
  const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!svcJson) {
    console.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set — auth will not work');
    return;
  }
  const parsed = JSON.parse(svcJson);
  admin.initializeApp({
    credential: admin.credential.cert(parsed),
  });
}

/**
 * Auth helper — verifies Authorization: Bearer <idToken> and returns uid
 */
async function getAuthenticatedUserId(req: NextApiRequest): Promise<string | null> {
  initFirebaseAdmin();
  const authHeader = (req.headers.authorization || '').trim();
  if (!authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice('Bearer '.length);
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid;
  } catch (err) {
    console.error('Failed to verify Firebase token', err);
    return null;
  }
}

/**
 * API Handler
 * - Accepts body: { payload: AuditLogInput, clientHash?: string }
 * - Server computes canonical payload, hash, optional prevHash, signature (private key or HMAC fallback), and stores it.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getAuthenticatedUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body as { payload?: AuditLogInput; clientHash?: string } | undefined;
  if (!body?.payload) return res.status(400).json({ error: 'Missing payload' });

  const payload = body.payload;

  if (!payload.resourceId || !payload.actionType || !payload.changes) {
    return res.status(400).json({ error: 'Missing required fields (resourceId, actionType, changes)' });
  }

  // Construct server-side canonical payload (explicit ordering)
  const timestamp = new Date().toISOString();
  const serverPayload = {
    userId,
    actionType: payload.actionType,
    resourceType: payload.resourceType ?? null,
    resourceId: payload.resourceId,
    changes: payload.changes,
    metadata: {
      ...payload.metadata,
      ip:
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ??
        (req.socket.remoteAddress ?? null),
      userAgent: req.headers['user-agent'] ?? null,
    },
    timestamp,
  };

  // Canonicalize and compute SHA-256 hex
  const canonical = canonicalizeForHash(serverPayload);
  const hash = sha256HexNode(canonical);

  // Optionally compute prevHash for the resource (chains per resource)
  let prevHash: string | null = null;
  try {
    initFirebaseAdmin();
    const db = admin.firestore();
    const lastSnapshot = await db
      .collection('audit_logs')
      .where('resourceId', '==', payload.resourceId)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    
    if (!lastSnapshot.empty) {
      const lastDoc = lastSnapshot.docs[0];
      prevHash = lastDoc.data().hash ?? null;
    }
  } catch (err) {
    console.error('Error fetching prevHash', err);
    // continue — not fatal
  }

  // Sign canonical payload or fallback to HMAC
  const PRIVATE_KEY_B64 = process.env.AUDIT_PRIVATE_KEY_B64; // base64 of PEM; preferred
  const HMAC_SECRET = process.env.AUDIT_HMAC_SECRET; // fallback (less strong)
  let signature = '';
  let keyId = process.env.AUDIT_KEY_ID ?? 'unknown';

  try {
    if (PRIVATE_KEY_B64) {
      const pem = Buffer.from(PRIVATE_KEY_B64, 'base64').toString('utf8');
      signature = signWithPrivateKey(pem, canonical);
      // keyId should be set in env when rotating keys
      keyId = process.env.AUDIT_KEY_ID ?? keyId;
    } else if (HMAC_SECRET) {
      // fallback: HMAC hex, base64-encoded
      const crypto = await import('crypto');
      const hmacHex = crypto.createHmac('sha256', HMAC_SECRET).update(canonical, 'utf8').digest('hex');
      signature = Buffer.from(hmacHex).toString('base64');
      keyId = process.env.AUDIT_KEY_ID ?? 'hmac-fallback';
    } else {
      // No signing configured — store empty signature but it's not recommended for legal uses
      console.warn('No AUDIT_PRIVATE_KEY_B64 or AUDIT_HMAC_SECRET configured; logs will be unsigned');
      signature = '';
    }
  } catch (err) {
    console.error('Signing error', err);
    return res.status(500).json({ error: 'Signing failed' });
  }

  // Store in Firestore
  try {
    initFirebaseAdmin();
    const db = admin.firestore();
    
    const auditLogData: Omit<AuditLog, 'id'> = {
      userId,
      actionType: payload.actionType,
      resourceType: payload.resourceType,
      resourceId: payload.resourceId,
      changes: payload.changes,
      metadata: serverPayload.metadata,
      timestamp,
      hash,
      prevHash: prevHash || undefined,
      signature,
      keyId,
    };

    const docRef = await db.collection('audit_logs').add(auditLogData);
    return res.status(201).json({ ok: true, id: docRef.id });
  } catch (err) {
    console.error('Failed to store audit log', err);
    return res.status(500).json({ error: 'Storage failed' });
  }
}
