# 🚨 Guia: Corrigir Problema de LOGOUT no Railway

## 🔴 Problema Identificado

Você está enfrentando o seguinte comportamento no Railway:

```
Cliente autenticado, carregando histórico de mensagens...
Cliente autenticado, carregando histórico de mensagens...
Cliente autenticado, carregando histórico de mensagens...
Cliente autenticado, carregando histórico de mensagens...
Cliente desconectado: LOGOUT
```

A mensagem **"Cliente autenticado"** aparecendo **MÚLTIPLAS VEZES** indica que há **múltiplas instâncias** do seu aplicativo rodando simultaneamente.

---

## ⚠️ Por Que Isso Causa LOGOUT?

1. **Railway inicia múltiplas réplicas** do seu app
2. **Cada réplica** tenta se conectar ao WhatsApp com a **mesma sessão**
3. **WhatsApp detecta** múltiplas conexões simultâneas do mesmo número
4. **WhatsApp desloga** todas as conexões por segurança

---

## ✅ SOLUÇÃO 1: Configurar Railway para 1 Réplica (RECOMENDADO)

Esta é a solução **MAIS SIMPLES** e **MAIS EFICAZ**.

### Passo a Passo:

1. **Acesse o Dashboard do Railway**
   - Vá para https://railway.app
   - Selecione seu projeto

2. **Configure o Número de Réplicas**
   - Clique no seu serviço
   - Vá em **"Settings"**
   - Role até a seção **"Deploy"**
   - Procure por **"Replicas"** ou **"Instances"**
   - **Defina para 1** (um)
   - Salve as alterações

3. **Redeploy**
   - Faça um novo deploy ou reinicie o serviço
   - Aguarde a aplicação subir
   - Autentique o WhatsApp novamente

### Verificar se Funcionou:

Nos logs, você deve ver **apenas UMA vez**:
```
╔═══════════════════════════════════════════════════════════╗
║         NOVA INSTÂNCIA DO SERVIDOR INICIADA              ║
╚═══════════════════════════════════════════════════════════╝
🆔 Instance ID: 1234567890-abc123
```

Se aparecer **múltiplas vezes** com IDs diferentes = **Múltiplas instâncias ainda rodando!**

---

## ✅ SOLUÇÃO 2: Usar Variável de Ambiente

Se a configuração de réplicas não estiver disponível, adicione esta variável de ambiente:

### No Railway:

1. Settings > Variables
2. Adicione:
   - **Nome:** `RAILWAY_REPLICA_ID`
   - **Valor:** `0`

Ou adicione um arquivo `railway.json` na raiz do projeto:

```json
{
  "deploy": {
    "numReplicas": 1
  }
}
```

---

## ✅ SOLUÇÃO 3: Adicionar Healthcheck Endpoint

O Railway pode estar criando múltiplas instâncias porque não detecta quando a app está pronta.

### Adicione ao `api-server.js`:

```javascript
// Adicione este endpoint antes de server.listen()
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        ready: isClientReady,
        canSendMessages: canRespondToMessages,
        instanceId: INSTANCE_ID
    });
});
```

### Configure no Railway:

1. Settings > Healthcheck
2. **Path:** `/health`
3. **Timeout:** 300 (segundos)

---

## ✅ SOLUÇÃO 4: Usar DISABLE_AUTO_SCALING (Railway Específico)

Adicione esta variável de ambiente no Railway:

- **Nome:** `RAILWAY_DEPLOYMENT_OVERRIDE_DEPLOY_REPLICAS`
- **Valor:** `1`

---

## 🔍 Como Verificar se o Problema Foi Resolvido

### 1. **Verifique os Logs de Inicialização**

Procure por:
```
╔═══════════════════════════════════════════════════════════╗
║         NOVA INSTÂNCIA DO SERVIDOR INICIADA              ║
╚═══════════════════════════════════════════════════════════╝
🆔 Instance ID: XXXXX
```

**✅ CORRETO:** Aparece **1 vez** com um único Instance ID
**❌ ERRADO:** Aparece **múltiplas vezes** com IDs diferentes

### 2. **Verifique o Evento READY**

Procure por:
```
✅ [READY EVENT] Cliente autenticado e pronto!
✅ [READY EVENT] Instance ID: XXXXX
```

**✅ CORRETO:** Aparece **1 vez**
**❌ ERRADO:** Aparece **múltiplas vezes** rapidamente

### 3. **Verifique se NÃO há Múltipla Inicialização**

Se houver múltiplas tentativas, você verá:
```
⚠️ ⚠️ ⚠️  ALERTA CRÍTICO: MÚLTIPLA INICIALIZAÇÃO DETECTADA! ⚠️ ⚠️ ⚠️
```

**✅ CORRETO:** Esta mensagem **NUNCA** aparece
**❌ ERRADO:** Esta mensagem aparece = múltiplas instâncias

---

## 🎯 Checklist de Diagnóstico

Após fazer as alterações e fazer deploy:

- [ ] Vejo apenas **1** mensagem "NOVA INSTÂNCIA DO SERVIDOR INICIADA"
- [ ] Vejo apenas **1** Instance ID único nos logs
- [ ] **NÃO** vejo mensagem de "MÚLTIPLA INICIALIZAÇÃO DETECTADA"
- [ ] Evento READY aparece apenas **1 vez**
- [ ] Após autenticar, **NÃO** recebo LOGOUT
- [ ] O bot permanece conectado e funcional

Se **TODOS** os itens estão marcados = ✅ **PROBLEMA RESOLVIDO!**

---

## 🚫 Se o LOGOUT Ainda Acontecer Após Corrigir Réplicas

Se você garantiu que há **apenas 1 réplica** e o LOGOUT ainda acontece, as possíveis causas são:

### 1. **WhatsApp Detectou Servidor/Datacenter**

**Sinais:**
- Logout acontece 1-5 minutos após autenticar
- Não há múltiplas instâncias nos logs
- Funciona localmente mas não no Railway

**Soluções:**

#### A) Usar Proxy Residencial
```javascript
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--proxy-server=http://seu-proxy-residencial:porta'
        ]
    }
});
```

#### B) Usar Serviço de Proxy (Bright Data, Oxylabs, etc)
- Contrate um serviço de proxy residencial
- Configure no Puppeteer

#### C) Migrar para VPS ao invés de PaaS
- Railway, Heroku, Render = são facilmente detectados
- Use VPS tradicional (DigitalOcean, Vultr, Linode)
- Configure manualmente

### 2. **Número Bloqueado/Restrito pelo WhatsApp**

**Teste:**
- Use outro número de telefone
- Se funcionar = número anterior foi bloqueado

**Solução:**
- Aguarde alguns dias sem tentar conectar
- Use número diferente para testes

### 3. **Comportamento Suspeito do Bot**

**Evite:**
- Enviar mensagens em massa muito rápido
- Enviar mesma mensagem para muitos contatos
- Responder instantaneamente (sem delay humano)

**Melhore:**
```javascript
// Adicione delay antes de responder
client.on('message', async (msg) => {
    // Simular delay humano (2-5 segundos)
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

    // Processar mensagem...
});
```

---

## 📊 Exemplo de Logs Corretos

```
╔═══════════════════════════════════════════════════════════╗
║         NOVA INSTÂNCIA DO SERVIDOR INICIADA              ║
╚═══════════════════════════════════════════════════════════╝
🆔 Instance ID: 1704301234567-abc123
🖥️  Hostname: railway-production-xyz
💻 Platform: linux
📍 Process PID: 1
⏰ Started at: 2026-01-03T15:00:00.000Z

============================================================
INICIANDO CLIENTE WHATSAPP - DEBUG MODE
============================================================
🆔 Instance ID: 1704301234567-abc123
Ambiente: production
Platform: linux
Diretório atual: /app
Diretório de autenticação: ./.wwebjs_auth
============================================================
✓ Diretório .wwebjs_auth EXISTE
✓ Arquivos encontrados: 1

📱 [QR EVENT] QR Code gerado. Escaneie com seu WhatsApp:
📱 [QR EVENT] Timestamp: 2026-01-03T15:00:15.000Z

🔐 [AUTHENTICATED EVENT] Cliente autenticado com sucesso!
🔐 [AUTHENTICATED EVENT] Instance ID: 1704301234567-abc123

✅ [READY EVENT] Cliente autenticado e pronto!
✅ [READY EVENT] Instance ID: 1704301234567-abc123
✓ [READY] Sessão persistida - Arquivos: 1

✅ Sistema pronto! Bot operacional.
```

**Note:** Todos os eventos mostram o **MESMO** Instance ID!

---

## 🆘 Suporte Adicional

Se após seguir **TODAS** as etapas o problema persistir:

1. **Copie TODOS os logs** desde o início até o LOGOUT
2. **Conte quantas vezes** aparece "NOVA INSTÂNCIA DO SERVIDOR INICIADA"
3. **Verifique** se todos os Instance IDs são iguais
4. **Confirme** a configuração de réplicas no Railway

---

## ⚡ Resumo Rápido

**Causa mais comum:** Múltiplas réplicas no Railway
**Solução mais simples:** Configurar para 1 réplica
**Verificação:** Logs devem mostrar apenas 1 Instance ID
**Alternativa:** Migrar para VPS tradicional

---

**Última atualização:** 2026-01-03
