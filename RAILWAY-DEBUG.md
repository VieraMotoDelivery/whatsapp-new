# 🚂 Debug do Problema de Logout Automático no Railway

## 📋 Problema
O WhatsApp se autentica normalmente no Railway, mas é **automaticamente deslogado** logo após a autenticação, enquanto funciona perfeitamente em ambiente local.

## 🔍 Como Diagnosticar

### 1. **Verificar os Logs no Railway**

Após fazer o deploy das alterações no `api-server.js`, observe os logs do Railway atentamente. Procure por:

#### Logs de Inicialização:
```
============================================================
INICIANDO CLIENTE WHATSAPP - DEBUG MODE
============================================================
Ambiente: production
Platform: linux
Diretório atual: /app
Diretório de autenticação: ./.wwebjs_auth
```

#### Logs de Autenticação:
```
🔐 [AUTHENTICATED EVENT] Cliente autenticado com sucesso!
✅ [READY EVENT] Cliente autenticado e pronto!
```

#### Logs de Desconexão (O MAIS IMPORTANTE):
```
⚠️ [DISCONNECTED EVENT] Cliente desconectado!
⚠️ [DISCONNECTED EVENT] Razão: XXXXX
```

**ATENÇÃO**: A razão da desconexão é a chave para resolver o problema!

---

## 🎯 Possíveis Causas e Soluções

### **Causa 1: Sistema de Arquivos Efêmero (Mais Provável)**

#### 🔍 Como Identificar:
Nos logs, você verá:
```
❌ [DISCONNECTED] CRÍTICO: Diretório de sessão DELETADO!
```

#### ❓ Por quê isso acontece?
O Railway usa containers com sistema de arquivos **efêmero**, ou seja, toda vez que o container reinicia (deploy, restart, crash), os arquivos são **perdidos**, incluindo a pasta `.wwebjs_auth/` que guarda sua sessão do WhatsApp.

#### ✅ Solução: Usar Volume Persistente no Railway

**Passo 1:** No dashboard do Railway, vá em seu projeto
**Passo 2:** Clique em "Settings" > "Volumes"
**Passo 3:** Adicione um novo volume:
- **Mount Path:** `/app/.wwebjs_auth`
- **Size:** 1GB (suficiente)

**Passo 4:** Faça redeploy do projeto

#### ✅ Solução Alternativa: Usar RemoteAuth

Se volumes não funcionarem, mude para **RemoteAuth** que salva a sessão em um banco de dados externo (MongoDB, etc):

```javascript
// Instalar: npm install whatsapp-web.js-mongo-store
const { RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');

// Conectar ao MongoDB
mongoose.connect('sua-url-mongodb');

const store = new MongoStore({ mongoose: mongoose });

const client = new Client({
    authStrategy: new RemoteAuth({
        store: store,
        backupSyncIntervalMs: 300000
    }),
    puppeteer: { /* ... */ }
});
```

---

### **Causa 2: Detecção de Servidor pelo WhatsApp**

#### 🔍 Como Identificar:
Nos logs, você verá a razão como `LOGOUT` ou desconexão logo após autenticação (segundos ou minutos).

#### ❓ Por quê isso acontece?
O WhatsApp pode detectar que está rodando em um datacenter/servidor e automaticamente deslogar por violar os termos de serviço.

#### ✅ Possíveis Soluções:

1. **Usar Proxy Residencial:**
   - Configure um proxy residencial para mascarar o IP do servidor

2. **Não há solução garantida:**
   - WhatsApp não oficialmente suporta bots/automação
   - Risco inerente ao usar em produção

---

### **Causa 3: Múltiplas Instâncias Executando**

#### 🔍 Como Identificar:
Se o Railway estiver rodando múltiplas réplicas do seu app, você verá desconexões aleatórias.

#### ✅ Solução:
No Railway, configure para rodar **apenas 1 instância**:
- Settings > Deploy > **Replicas: 1**

---

### **Causa 4: Timeout/Problemas de Rede**

#### 🔍 Como Identificar:
Nos logs, você verá erros de timeout ou problemas de conexão antes da desconexão.

#### ✅ Solução:
Adicione mais timeout nas configurações do Puppeteer:

```javascript
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        timeout: 60000 // Aumentar timeout para 60 segundos
    },
    authTimeoutMs: 60000 // Timeout de autenticação
});
```

---

### **Causa 5: Problemas de Memória/CPU**

#### 🔍 Como Identificar:
O app crasha ou fica lento antes de desconectar.

#### ✅ Solução:
- Aumente os recursos do plano no Railway
- No Railway Settings, aumente RAM e CPU

---

## 📊 Analisando os Logs

### O que procurar nos logs:

1. **Sequência normal de eventos:**
```
INICIANDO CLIENTE WHATSAPP
📱 [QR EVENT] QR Code gerado
🔐 [AUTHENTICATED EVENT] Cliente autenticado
✅ [READY EVENT] Cliente autenticado e pronto
✓ [READY] Sessão persistida
```

2. **Problema de persistência:**
```
✅ [READY EVENT] Cliente autenticado e pronto
⚠️ [READY] ALERTA: Diretório de sessão NÃO encontrado!
⚠️ [DISCONNECTED EVENT] Cliente desconectado!
❌ [DISCONNECTED] CRÍTICO: Diretório de sessão DELETADO!
```

3. **Logout pelo WhatsApp:**
```
⚠️ [DISCONNECTED EVENT] Razão: LOGOUT
🚫 [DISCONNECTED] Razão é LOGOUT - NÃO vai reconectar
```

---

## 🛠️ Checklist de Debug

- [ ] Fiz deploy do código com logs detalhados
- [ ] Verifiquei os logs no Railway após autenticar
- [ ] Identifiquei a razão da desconexão
- [ ] Verifiquei se o diretório `.wwebjs_auth/` existe após desconexão
- [ ] Configurei volume persistente no Railway (se necessário)
- [ ] Verifiquei que apenas 1 réplica está rodando
- [ ] Testei com RemoteAuth (se LocalAuth falhou)

---

## 📝 Próximos Passos

1. **Faça commit e deploy das alterações:**
```bash
git add api-server.js
git commit -m "feat: Adiciona logs detalhados para debug no Railway"
git push
```

2. **Monitore os logs no Railway:**
   - Acesse o dashboard do Railway
   - Vá em "Deployments" > "View Logs"
   - Faça a autenticação do WhatsApp
   - **Copie todos os logs** especialmente do momento da desconexão

3. **Com base nos logs, identifique a causa** usando este documento

4. **Aplique a solução correspondente**

---

## 🆘 Ainda com Problemas?

Se após seguir todos os passos o problema persistir:

1. Copie os logs completos do Railway
2. Verifique se a razão da desconexão está clara
3. Procure por erros específicos nos logs
4. Considere alternativas como usar um VPS tradicional ao invés de PaaS

---

## ⚠️ Aviso Importante

**WhatsApp não oficialmente suporta bots ou clientes não oficiais.** O uso desta biblioteca pode resultar em:
- Banimento temporário ou permanente do número
- Desconexões frequentes
- Restrições de funcionalidades

Use por sua conta e risco, preferencialmente com um número de testes.

---

**Última atualização:** 2026-01-03
