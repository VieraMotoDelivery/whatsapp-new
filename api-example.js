const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:7005';

async function sendMessage(number, message) {
    try {
        const response = await fetch(`${API_BASE_URL}/send-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                number: number,
                message: message
            })
        });

        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Mensagem enviada:', result);
        } else {
            console.log('❌ Erro:', result.error);
        }
        
        return result;
    } catch (error) {
        console.error('❌ Erro na requisição:', error.message);
        return { success: false, error: error.message };
    }
}

async function sendGroupMessage(name, message) {
    try {
        const response = await fetch(`${API_BASE_URL}/send-group-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                message: message
            })
        });

        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Mensagem para grupo enviada:', result);
        } else {
            console.log('❌ Erro:', result.error);
        }
        
        return result;
    } catch (error) {
        console.error('❌ Erro na requisição:', error.message);
        return { success: false, error: error.message };
    }
}

async function checkStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/status`);
        const result = await response.json();
        console.log('📱 Status do cliente:', result);
        return result;
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error.message);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('🚀 Testando API WhatsApp...\n');
    
    console.log('1. Verificando status...');
    await checkStatus();
    
    console.log('\n2. Enviando mensagem de teste...');
    await sendMessage('5511999999999', 'Olá! Esta é uma mensagem de teste da API.');
    
    console.log('\n3. Enviando mensagem para grupo de teste...');
    await sendGroupMessage('oioi', 'Olá grupo! Esta é uma mensagem de teste para grupo.');
    
    console.log('\n✨ Teste concluído!');
}

if (require.main === module) {
    main();
}

module.exports = { sendMessage, sendGroupMessage, checkStatus };