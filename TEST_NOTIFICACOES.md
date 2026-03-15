# Guia de Teste de Notificações PWA - MINSA Prep

## Problemas Identificados e Corrigidos

### ❌ **Problemas Antigos:**
1. **Conflito VAPID/FCM**: Código misturava Web Push VAPID com Firebase Cloud Messaging
2. **Service Worker Desatualizado**: Usava Firebase SDK v9 compat sem handlers adequados
3. **Manifest PWA Incompleto**: Faltava configuração FCM adequada
4. **Token FCM Inválido**: VAPID key interferia na geração do token

### ✅ **Correções Aplicadas:**
1. **Removido VAPID do Firebase**: Eliminada dependência de VAPID keys no token FCM
2. **Service Worker Otimizado**: Adicionado `messaging.onBackgroundMessage()` para FCM
3. **Manifest Atualizado**: Adicionado `gcm_sender_id` e configurações FCM
4. **Cache Limpo**: Atualizado version do cache para forçar reload

## Passos para Testar

### 1. **Limpar Cache do Navegador**
- Abrir DevTools (F12)
- Application → Storage → Clear site data
- Ou usar Ctrl+Shift+R para hard refresh

### 2. **Verificar Service Worker**
- DevTools → Application → Service Workers
- Confirmar que `/sw.js` está "activated and is running"

### 3. **Testar Permissões**
- Fazer login na app
- Ir para Profile → "Testar e Ligar Notificações Push"
- Aceitar permissão quando solicitada

### 4. **Verificar Console**
- Verificar logs de sucesso:
  - `[Firebase] Token FCM obtido com sucesso ✅`
  - `[Push] Sucesso: Ligação ativa ✅`

### 5. **Testar Notificação**
- Enviar notificação de teste do Profile
- Verificar se aparece na barra de notificações

### 6. **Testar Background**
- Minimizar app ou fechar aba
- Enviar outra notificação
- Verificar se aparece em background

## Logs Importantes

### ✅ **Logs de Sucesso:**
```
[Firebase] Permissão concedida. A aguardar Service Worker principal (/sw.js)...
[Firebase] Token FCM obtido com sucesso ✅
[Push] Token obtido, a guardar no Supabase...
[Push] Sucesso: Ligação ativa ✅
```

### ❌ **Logs de Erro:**
```
[Firebase] Permissão Negada: Bloqueaste as notificações...
[Firebase] O Firebase não devolveu um token de ligação...
[Push] Erro na subscrição: ...
```

## Verificação Final

1. **Service Worker Ativo**: Application → Service Workers
2. **Permissão Concedida**: Notification.permission = "granted"
3. **Token FCM Salvo**: Verificar tabela `push_subscriptions` no Supabase
4. **Notificação Recebida**: Teste visual na barra de notificações

## Troubleshooting

### Se não funcionar:
1. **Limpar cache e refazer processo**
2. **Verificar HTTPS** (obrigatório para notificações)
3. **Confirmar variáveis de ambiente** no `.env`
4. **Testar em navegador diferente** (Chrome/Edge recomendados)

### Se token não for gerado:
1. **Verificar se Service Worker está registrado**
2. **Confirmar Firebase config correta**
3. **Testar em ambiente HTTPS válido**
