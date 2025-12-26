// Node server crypto helpers (Node >= 16). Use native 'crypto'.
// This computes SHA-256 hex and signs data with RSA private key (PEM).
// You must keep the privateKey secret (env var or KMS).

import crypto from 'crypto';
import { stableStringify } from '../lib/stableStringify';

export function sha256HexNode(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

// Example: sign the canonical payload using RSA private key (PEM) and return base64 signature.
// For legal/auditable signing prefer an asymmetric key stored in KMS (AWS KMS, Google KMS, Azure KeyVault).
export function signWithPrivateKey(privateKeyPem: string, data: string): string {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(data, 'utf8');
  sign.end();
  const sig = sign.sign(privateKeyPem);
  return sig.toString('base64');
}

// Alternative: HMAC with a server secret (less ideal for legal proof than asymmetric signature).
export function hmacHex(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex');
}

// Canonicalize object and return canonical string
export function canonicalizeForHash(obj: unknown): string {
  return stableStringify(obj);
}