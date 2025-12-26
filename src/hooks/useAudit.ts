// Client-side hook to prepare and POST audit logs to the server.
// The server will compute its own timestamp/hash/signature and store immutable logs.

import { useCallback } from 'react';
import { AuditLogInput } from '../types/audit';
import { stableStringify } from '../lib/stableStringify';
import { sha256HexBrowser } from '../lib/crypto-browser';

type UseAuditOptions = {
  endpoint?: string; // e.g. "/api/audit"
  getUserId?: () => string | null; // fallback to your auth context
};

export function useAudit(options?: UseAuditOptions) {
  const endpoint = options?.endpoint ?? '/api/audit';

  // Simple helper to get user id (you'll likely replace with your auth context)
  const getUserId = options?.getUserId ?? (() => null);

  const log = useCallback(
    async (partial: Omit<AuditLogInput, 'userId'> & { userId?: string }) => {
      const userId = partial.userId ?? getUserId();
      if (!userId) {
        console.warn('No user id available for audit; aborting');
        return;
      }

      const payload: AuditLogInput = {
        userId,
        actionType: partial.actionType,
        resourceType: partial.resourceType,
        resourceId: partial.resourceId,
        changes: partial.changes,
        metadata: partial.metadata ?? {},
        timestamp: new Date().toISOString(),
      };

      // Optional: client compute a hash to include as a client-side fingerprint.
      // Server MUST compute final canonical hash and sign it.
      try {
        const canonical = stableStringify({
          userId: payload.userId,
          actionType: payload.actionType,
          resourceType: payload.resourceType,
          resourceId: payload.resourceId,
          changes: payload.changes,
          metadata: payload.metadata,
          timestamp: payload.timestamp,
        });
        const clientHash = await sha256HexBrowser(canonical);
        // Send payload + clientHash (server will compute its own serverHash)
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // include credentials (cookies) or Authorization header depending on your auth
          },
          body: JSON.stringify({ payload, clientHash }),
        });
      } catch (err) {
        console.error('Failed to send audit log', err);
      }
    },
    [endpoint, getUserId]
  );

  return { log };
}
