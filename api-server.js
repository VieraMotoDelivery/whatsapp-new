const express = require('express');
const { Client, LocalAuth } = require('./index.js');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 7005;

app.use(express.json());

let client;
let isClientReady = false;

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

    client.on('qr', (qr) => {
        console.log('QR Code gerado. Escaneie com seu WhatsApp:');
        qrcode.generate(qr, {small: true});
    });

    client.on('ready', () => {
        console.log('Cliente WhatsApp está pronto!');
        isClientReady = true;
    });

    client.on('authenticated', () => {
        console.log('Cliente autenticado!');
    });

    client.on('auth_failure', (msg) => {
        console.error('Falha na autenticação:', msg);
    });

    client.on('disconnected', (reason) => {
        console.log('Cliente desconectado:', reason);
        isClientReady = false;
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
    res.json({
        message: 'API WhatsApp Web.js',
        endpoints: {
            'POST /send-message': 'Enviar mensagem (body: {number, message})',
            'POST /send-group-message': 'Enviar mensagem para grupo (body: {name, message})',
            'GET /status': 'Status do cliente WhatsApp'
        }
    });
});

app.listen(PORT, () => {
    console.log(`Servidor API rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
    console.log('Inicializando cliente WhatsApp...');
    initializeClient();
});