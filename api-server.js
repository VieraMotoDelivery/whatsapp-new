const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('./index.js');
const qrcode = require('qrcode-terminal');
const { fisica } = require('./src/fisica');
const { empresa } = require('./src/empresa');
const { clientecadastro } = require('./src/clientecadastro');
const { sosregistrarcodigo } = require('./src/sosregistrarcodigo');
const { Requests } = require('./src/request');
const {
    codigoetelefone,
    checkingNumbers,
    cronJob,
    listarentregasequantidade,
    listartodosclientescadastrados,
    buscardadosdecadastradodaempresa,
    deletarentregas,
    deletarcliente,
    ativarchatbot,
    desativarchatbot,
    listarQuantidadeDeEntregasDaEmpresa,
    excluirnumerocliente
} = require('./src/middlewares');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 7005;

app.use(express.json());

let client;
let isClientReady = false;
let canRespondToMessages = false;
let warmupTimeout = null;

const messageTracker = new Map();
const BLOCK_THRESHOLD = 5;
const TIME_WINDOW = 300000;
const WARMUP_PERIOD = 20000;

function shouldBlockMessage(phoneNumber, messageContent) {
    const key = `${phoneNumber}:${messageContent.toLowerCase().trim()}`;
    const now = Date.now();

    if (!messageTracker.has(key)) {
        messageTracker.set(key, { count: 1, firstSeen: now });
        return false;
    }

    const data = messageTracker.get(key);

    if (now - data.firstSeen > TIME_WINDOW) {
        messageTracker.set(key, { count: 1, firstSeen: now });
        return false;
    }

    data.count++;

    if (data.count >= BLOCK_THRESHOLD) {
        console.log(`BLOCKED: ${phoneNumber} - Mensagem repetida ${data.count} vezes: "${messageContent}"`);
        return true;
    }

    return false;
}

function cleanupOldEntries() {
    const now = Date.now();
    for (const [key, data] of messageTracker.entries()) {
        if (now - data.firstSeen > TIME_WINDOW) {
            messageTracker.delete(key);
        }
    }
}

setInterval(cleanupOldEntries, 600000);

const initializeClient = () => {
    client = new Client({
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
            ]
        }
    });

    client.on('qr', async (qr) => {
        console.log('QR Code gerado. Escaneie com seu WhatsApp:');
        qrcode.generate(qr, {small: true});

        const qrDataURL = await QRCode.toDataURL(qr);
        io.emit('qr', qrDataURL);
    });

    client.on('ready', () => {
        console.log('Cliente autenticado, carregando histórico de mensagens...');
        isClientReady = true;
        canRespondToMessages = false;

        io.emit('warmup_started', { message: 'Carregando histórico de mensagens, aguarde...', duration: WARMUP_PERIOD });

        if (warmupTimeout) {
            clearTimeout(warmupTimeout);
        }

        warmupTimeout = setTimeout(() => {
            canRespondToMessages = true;
            console.log('✅ Sistema pronto! Bot operacional.');
            io.emit('warmup_completed', { message: '✅ Sistema pronto! Bot operacional.' });
        }, WARMUP_PERIOD);

        cronJob();
    });

    client.on('authenticated', () => {
        console.log('Cliente autenticado!');
        io.emit('authenticated');
    });

    client.on('auth_failure', (msg) => {
        console.error('Falha na autenticação:', msg);
        io.emit('auth_failure', msg);
    });

    client.on('disconnected', (reason) => {
        console.log('Cliente desconectado:', reason);
        isClientReady = false;
        canRespondToMessages = false;

        if (warmupTimeout) {
            clearTimeout(warmupTimeout);
            warmupTimeout = null;
        }

        io.emit('disconnected', reason);

        if (reason !== 'LOGOUT') {
            console.log('Tentando reconectar...');
            setTimeout(() => {
                client.initialize();
            }, 5000);
        }
    });

    client.on('error', (error) => {
        console.error('ERRO DO CLIENT:', error);
        isClientReady = false;
    });

    client.on('loading_screen', (percent, message) => {
        console.log('Carregando:', percent, '%');
        io.emit('loading', { percent, message });
    });

    client.on('message', async (msg) => {
        console.log('MENSAGEM RECEBIDA:', msg.from, '-', msg.body);

        if (msg.from === 'status@broadcast') {
            console.log('STATUS IGNORADO: Mensagem de status do WhatsApp');
            return;
        }

        if (!canRespondToMessages) {
            const logMsg = `AQUECIMENTO: Mensagem ignorada durante período de aquecimento de ${msg.from}: "${msg.body}"`;
            console.log(logMsg);
            io.emit('message_ignored', { from: msg.from, body: msg.body, reason: 'warmup' });
            return;
        }

        if (shouldBlockMessage(msg.from, msg.body)) {
            console.log(`Mensagem bloqueada de ${msg.from}: "${msg.body}"`);
            io.emit('message_blocked', { from: msg.from, body: msg.body, reason: 'spam' });
            return;
        }

        let msgNumber = await checkingNumbers(msg);
        let etapaRetrieve = await Requests.retrieveEtapa(msg);
        let codigotelefone = codigoetelefone(msg.from, msgNumber);
        let buscarseexistetelefonenobanco = await Requests.buscartelefonenobanco(msg.from);

        const date = new Date();
        const h = date.getHours();

        if (etapaRetrieve !== undefined && etapaRetrieve.ativado == true) {
            sosregistrarcodigo(msg, etapaRetrieve, client);
            clientecadastro(msgNumber, msg, etapaRetrieve, client);
            const message = msg.body.toLowerCase();
            let desativar = message.slice(0, 9);
            let ativar = message.slice(0, 6);
            let listDelivery = message.includes('entregas/');

            if (buscarseexistetelefonenobanco && !listDelivery && ativar != 'ativar' && desativar != 'desativar') {
                if (h >= 10 && h < 23) {
                    empresa(msg, msgNumber, etapaRetrieve, codigotelefone, client);
                } else if (h < 10) {
                    client.sendMessage(msg.from, `Olá! 😃
Gostaríamos de informar que nosso horário de *atendimento* inicia as 🕥 10h00 até às 23h00 🕙 e as atividades das 🕥 10h30 até às 23h00 🕙.

Alguma dúvida ou assistência, recomendamos que entre em contato novamente mais tarde. 🏍️

Obrigado pela compreensão!`);
                } else if (h > 10 && h >= 23) {
                    client.sendMessage(msg.from, `Pedimos desculpas pelo inconveniente, pois nosso horário de *atendimento* é das 🕥 10h30 até às 23h00 🕙.

Se você tiver alguma dúvida ou precisar de assistência nos mande uma mensagem no grupo de whatsApp.

Agradecemos pela compreensão.`);
                }
            } else if (!buscarseexistetelefonenobanco && !listDelivery) {
                if (h >= 10 && h < 23) {
                    let registrarCode = msg.body.includes('/registrar/.');
                    let registrar = msg.body.includes('/registrar');
                    if (!registrarCode && !registrar) {
                        fisica(msg, etapaRetrieve, client, buscarseexistetelefonenobanco);
                    }
                } else if (h < 10) {
                    client.sendMessage(msg.from, `Olá! 😃
Gostaríamos de informar que nosso horário de *atendimento* inicia as 🕥 10h00 até às 23h00 🕙 e as atividades das 🕥 10h30 até às 23h00 🕙.

Alguma dúvida ou assistência, recomendamos que entre em contato novamente mais tarde. 🏍️

Obrigado pela compreensão!`);
                } else if (h > 10 && h >= 23) {
                    client.sendMessage(msg.from, `Olá! 😃
Pedimos desculpas pelo inconveniente, pois nosso horário de *atendimento* é das 🕥 10h30 até às 23h00 🕙.

Se você tiver alguma dúvida ou precisar de assistência recomendamos que entre em contato conosco novamente amanhã a partir das 🕙 10h00, quando retomaremos nossas atividades. 🏍️

Agradecemos pela compreensão.`);
                }
            }
        }

        listarentregasequantidade(msg, client);
        listartodosclientescadastrados(msg, client);
        buscardadosdecadastradodaempresa(msg, client, msgNumber);
        deletarentregas(msg, client);
        deletarcliente(msg, client);
        ativarchatbot(msg, client);
        desativarchatbot(msg, client);
        listarQuantidadeDeEntregasDaEmpresa(codigotelefone, msg, client);
        excluirnumerocliente(msg, client);
    });

    client.initialize();
};

app.post('/send-message', async (req, res) => {
    try {
        const { number, message } = req.body;

        if (!number || !message) {
            return res.status(400).json({
                success: false,
                error: 'Campos "number" e "message" são obrigatórios'
            });
        }

        if (!isClientReady) {
            return res.status(503).json({
                success: false,
                error: 'Cliente WhatsApp não está pronto. Aguarde a inicialização.'
            });
        }

        const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
        
        const sentMessage = await client.sendMessage(chatId, message);

        res.json({
            success: true,
            message: 'Mensagem enviada com sucesso',
            messageId: sentMessage.id.id,
            to: number
        });

    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor ao enviar mensagem'
        });
    }
});

app.post('/send-group-message', async (req, res) => {
    try {
        const { name, message } = req.body;

        if (!name || !message) {
            return res.status(400).json({
                success: false,
                error: 'Campos "name" e "message" são obrigatórios'
            });
        }

        if (!isClientReady) {
            return res.status(503).json({
                success: false,
                error: 'Cliente WhatsApp não está pronto. Aguarde a inicialização.'
            });
        }

        // Buscar o grupo pelo nome
        const chats = await client.getChats();
        const group = chats.find(chat => 
            chat.isGroup && 
            chat.name.toLowerCase().includes(name.toLowerCase())
        );

        if (!group) {
            return res.status(404).json({
                success: false,
                error: `Grupo "${name}" não encontrado`
            });
        }

        const sentMessage = await client.sendMessage(group.id._serialized, message);

        res.json({
            success: true,
            message: 'Mensagem enviada para o grupo com sucesso',
            messageId: sentMessage.id.id,
            groupName: group.name,
            groupId: group.id._serialized
        });

    } catch (error) {
        console.error('Erro ao enviar mensagem para grupo:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor ao enviar mensagem para grupo'
        });
    }
});

app.get('/status', (req, res) => {
    res.json({
        success: true,
        clientReady: isClientReady,
        status: isClientReady ? 'ready' : 'initializing'
    });
});

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp QR Code</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }

        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }

        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }

        #qr-container {
            background: #f5f5f5;
            border-radius: 15px;
            padding: 20px;
            margin: 20px 0;
            min-height: 300px;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        #qrcode {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
        }

        .status {
            padding: 12px 24px;
            border-radius: 25px;
            font-weight: 500;
            font-size: 14px;
            margin-top: 20px;
            display: inline-block;
        }

        .status.waiting {
            background: #fff3cd;
            color: #856404;
        }

        .status.authenticated {
            background: #d4edda;
            color: #155724;
        }

        .status.ready {
            background: #d1ecf1;
            color: #0c5460;
        }

        .status.error {
            background: #f8d7da;
            color: #721c24;
        }

        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            vertical-align: middle;
            margin-right: 10px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .info {
            background: #e7f3ff;
            border-left: 4px solid #2196F3;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
            text-align: left;
        }

        .info-title {
            font-weight: 600;
            color: #1976D2;
            margin-bottom: 8px;
        }

        .info-text {
            color: #555;
            font-size: 13px;
            line-height: 1.6;
        }

        .success-icon {
            font-size: 64px;
            color: #28a745;
            animation: checkmark 0.5s ease-in-out;
        }

        @keyframes checkmark {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>WhatsApp Web</h1>
        <p class="subtitle">Escaneie o QR Code para conectar</p>

        <div id="qr-container">
            <div class="loading"></div>
        </div>

        <div id="status" class="status waiting">
            Aguardando QR Code...
        </div>

        <div class="info">
            <div class="info-title">Como conectar:</div>
            <div class="info-text">
                1. Abra o WhatsApp no seu celular<br>
                2. Toque em Menu ou Configurações<br>
                3. Toque em Aparelhos conectados<br>
                4. Toque em Conectar um aparelho<br>
                5. Aponte seu celular para esta tela para escanear o QR Code
            </div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        const qrContainer = document.getElementById('qr-container');
        const statusDiv = document.getElementById('status');

        socket.on('qr', (qrData) => {
            console.log('QR Code recebido');
            qrContainer.innerHTML = '<img id="qrcode" src="' + qrData + '" alt="QR Code">';
            statusDiv.textContent = 'Escaneie o QR Code';
            statusDiv.className = 'status waiting';
        });

        socket.on('authenticated', () => {
            console.log('Autenticado');
            statusDiv.textContent = 'Autenticado com sucesso!';
            statusDiv.className = 'status authenticated';
            qrContainer.innerHTML = '<div class="success-icon">✓</div>';
        });

        socket.on('ready', () => {
            console.log('Pronto');
            statusDiv.textContent = 'WhatsApp conectado e pronto!';
            statusDiv.className = 'status ready';
        });

        socket.on('warmup_started', (data) => {
            console.log('Aquecimento iniciado:', data);
            let secondsLeft = Math.floor(data.duration / 1000);

            const updateCountdown = () => {
                if (secondsLeft > 0) {
                    statusDiv.textContent = `Carregando histórico de mensagens, aguarde... (${secondsLeft}s)`;
                    statusDiv.className = 'status waiting';
                    secondsLeft--;
                    setTimeout(updateCountdown, 1000);
                }
            };

            updateCountdown();
        });

        socket.on('warmup_completed', (data) => {
            console.log('Aquecimento concluído:', data);
            statusDiv.textContent = data.message;
            statusDiv.className = 'status ready';
        });

        socket.on('message_ignored', (data) => {
            console.log('Mensagem ignorada (aquecimento):', data.from, '-', data.body);
        });

        socket.on('message_blocked', (data) => {
            console.log('Mensagem bloqueada (spam):', data.from, '-', data.body);
        });

        socket.on('loading', (data) => {
            console.log('Carregando:', data.percent + '%');
            statusDiv.textContent = 'Carregando... ' + data.percent + '%';
            statusDiv.className = 'status waiting';
        });

        socket.on('auth_failure', (msg) => {
            console.error('Falha na autenticação:', msg);
            statusDiv.textContent = 'Falha na autenticação';
            statusDiv.className = 'status error';
            qrContainer.innerHTML = '<div style="color: #dc3545; font-size: 48px;">✗</div>';
        });

        socket.on('disconnected', (reason) => {
            console.log('Desconectado:', reason);
            statusDiv.textContent = 'Desconectado: ' + reason;
            statusDiv.className = 'status error';
        });
    </script>
</body>
</html>
    `);
});

server.listen(PORT, () => {
    console.log(`Servidor API rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
    console.log('Inicializando cliente WhatsApp...');
    initializeClient();
});