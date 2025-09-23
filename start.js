#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando WhatsApp API Server...\n');

// Inicia o servidor API
const apiServer = spawn('node', ['api-server.js'], {
    cwd: __dirname,
    stdio: 'inherit'
});

// Tratamento de sinais para encerrar o processo corretamente
process.on('SIGINT', () => {
    console.log('\n⏹️  Encerrando servidor...');
    apiServer.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n⏹️  Encerrando servidor...');
    apiServer.kill('SIGTERM');
    process.exit(0);
});

apiServer.on('close', (code) => {
    console.log(`\n📱 Servidor encerrado com código: ${code}`);
    process.exit(code);
});

apiServer.on('error', (error) => {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
});