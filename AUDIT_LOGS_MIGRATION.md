# Migração de Audit Logs: Prisma → Firebase Firestore

## 📋 Resumo das Alterações

O sistema de auditoria foi migrado de **Prisma** para **Firebase Firestore**, permitindo melhor escalabilidade e integração com o Firebase.

## ✅ Arquivos Modificados

### 1. **`src/pages/api/audit.ts`** (Principal)
- ✅ Removido: `PrismaClient` e suas dependências
- ✅ Adicionado: Firebase Admin SDK (Firestore)
- ✅ Alterado: Sistema de armazenamento para usar `admin.firestore()`
- ✅ Mantido: Todas as funcionalidades de hash, assinatura e segurança

#### Principais Mudanças:
```typescript
// ❌ Antes (Prisma):
const prisma = new PrismaClient();
const last = await prisma.auditLog.findFirst({...});
await prisma.auditLog.create({data: {...}});

// ✅ Depois (Firestore):
const db = admin.firestore();
const lastSnapshot = await db.collection('audit_logs')
  .where('resourceId', '==', payload.resourceId)
  .orderBy('timestamp', 'desc')
  .limit(1)
  .get();

await db.collection('audit_logs').add(auditLogData);
```

## 🔥 Estrutura Firebase Firestore

### Coleção: `audit_logs`

Cada documento contém:

```json
{
  "userId": "string",
  "actionType": "CREATE|UPDATE|DELETE",
  "resourceType": "string|null",
  "resourceId": "string",
  "changes": {
    "[fieldName]": {
      "before": "any",
      "after": "any"
    }
  },
  "metadata": {
    "ip": "string|null",
    "userAgent": "string|null",
    "[key]": "any"
  },
  "timestamp": "ISO-8601-string",
  "hash": "string (SHA-256 hex)",
  "prevHash": "string|null",
  "signature": "string (base64)",
  "keyId": "string"
}
```

## 🔐 Segurança Mantida

✅ **Integridade de Dados**: Hash SHA-256 com assinatura criptográfica
✅ **Encadeamento**: `prevHash` permite verificar a sequência de logs
✅ **Autenticação**: Verificação de Firebase ID Token via Bearer token
✅ **Metadados Automáticos**: IP e User-Agent capturados

## 📝 Uso do Hook `useAudit`

O hook cliente permanece **inalterado**:

```typescript
import { useAudit } from '@/hooks/useAudit';

function MyComponent() {
  const { log } = useAudit();

  const handlePatientUpdate = async (patient: Patient) => {
    await log({
      actionType: 'UPDATE',
      resourceType: 'patient',
      resourceId: patient.id,
      changes: {
        status: { before: 'Observação', after: 'Alta' },
        conduta: { before: oldConduta, after: newConduta },
      },
    });
  };
}
```

## 🔧 Variáveis de Ambiente Necessárias

```bash
# Firebase Admin Service Account (obrigatório)
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# Assinatura de Logs (opcional, preferencial)
AUDIT_PRIVATE_KEY_B64='base64-encoded-PEM-key'
AUDIT_KEY_ID='current-key-version'

# Fallback HMAC (optional, if no private key)
AUDIT_HMAC_SECRET='your-hmac-secret'
```

## 🚀 Índices Firebase Recomendados

Para otimizar queries, criar os seguintes índices no Firestore:

1. **`audit_logs`**: Índice composto
   - Campo: `resourceId` (Ascending)
   - Campo: `timestamp` (Descending)

2. **`audit_logs`**: Índice composto (opcional, para análises)
   - Campo: `userId` (Ascending)
   - Campo: `timestamp` (Descending)

### Via Firebase Console:
1. Firestore Database → Índices → Índices Compostos
2. Clique em "Criar Índice"
3. Configure conforme acima

Ou via CLI:
```bash
firebase firestore:indexes
```

## ✨ Benefícios da Migração

| Aspecto | Prisma | Firestore |
|--------|--------|-----------|
| **Escalabilidade** | Limitada ao BD relacional | Escalável globalmente |
| **Queries em Tempo Real** | Não nativo | Nativo com listeners |
| **Integração Firebase** | Manual | Integrada nativamente |
| **Sem Servidor** | Requer servidor DB | Totalmente serverless |
| **Custo** | DB server 24/7 | Pay-per-use |

## 📋 Checklist de Implementação

- [x] Migrar lógica de armazenamento para Firestore
- [x] Remover dependência de Prisma
- [x] Manter segurança e integridade de dados
- [x] Manter compatibilidade com hook cliente
- [ ] Criar índices Firestore (fazer manualmente no console)
- [ ] Testar fluxo de auditoria end-to-end
- [ ] Atualizar documentação para DevOps

## 🧪 Testes Recomendados

```bash
# 1. Verificar se Firestore collection é criada automaticamente
curl -X POST http://localhost:3000/api/audit \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "actionType": "CREATE",
      "resourceId": "test-patient-123",
      "changes": {"name": {"before": null, "after": "John"}}
    }
  }'

# 2. Verificar no Firebase Console:
# - Firestore → audit_logs → verificar documentos criados
# - Verificar hash, signature, timestamp
```

## 🔄 Rollback (se necessário)

Se precisar voltar ao Prisma:
1. Restaurar arquivo original: `src/pages/api/audit.ts`
2. Reinstalar Prisma: `npm install @prisma/client`
3. Executar migrações: `npx prisma migrate deploy`

---

**Data da Migração**: Dezembro 2025  
**Versão**: 1.0  
**Status**: ✅ Completo
