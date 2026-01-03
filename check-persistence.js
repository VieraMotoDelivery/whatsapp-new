#!/usr/bin/env node

/**
 * Script para verificar persistência de dados no Railway
 *
 * Este script cria um arquivo de teste no diretório .wwebjs_auth
 * e verifica se ele persiste entre reinicializações do container.
 *
 * Como usar:
 * 1. Execute: node check-persistence.js write
 * 2. Faça redeploy no Railway
 * 3. Execute: node check-persistence.js read
 * 4. Se o arquivo foi lido com sucesso, a persistência está funcionando
 */

const fs = require('fs');
const path = require('path');

const AUTH_DIR = path.join(process.cwd(), '.wwebjs_auth');
const TEST_FILE = path.join(AUTH_DIR, 'persistence-test.json');

function ensureAuthDirExists() {
    if (!fs.existsSync(AUTH_DIR)) {
        console.log('📁 Criando diretório .wwebjs_auth...');
        fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
}

function writeTestFile() {
    ensureAuthDirExists();

    const testData = {
        timestamp: new Date().toISOString(),
        message: 'Se você está lendo isso após um redeploy, a persistência está funcionando!',
        platform: process.platform,
        nodeVersion: process.version,
        cwd: process.cwd()
    };

    fs.writeFileSync(TEST_FILE, JSON.stringify(testData, null, 2));

    console.log('✅ Arquivo de teste criado com sucesso!');
    console.log('📄 Local:', TEST_FILE);
    console.log('📅 Timestamp:', testData.timestamp);
    console.log('');
    console.log('🚀 Próximo passo:');
    console.log('   1. Faça commit e push das alterações');
    console.log('   2. Aguarde o redeploy no Railway');
    console.log('   3. Execute: node check-persistence.js read');
}

function readTestFile() {
    console.log('🔍 Verificando persistência de dados...');
    console.log('📁 Diretório:', AUTH_DIR);
    console.log('📄 Arquivo de teste:', TEST_FILE);
    console.log('');

    // Verificar se o diretório existe
    if (!fs.existsSync(AUTH_DIR)) {
        console.log('❌ FALHA: Diretório .wwebjs_auth NÃO EXISTE!');
        console.log('');
        console.log('🔧 Solução: Configure um volume persistente no Railway');
        console.log('   Mount Path: /app/.wwebjs_auth');
        console.log('   Size: 1GB');
        return false;
    }

    console.log('✅ Diretório .wwebjs_auth existe');

    // Listar arquivos no diretório
    const files = fs.readdirSync(AUTH_DIR);
    console.log(`📂 Arquivos encontrados (${files.length}):`, files);
    console.log('');

    // Verificar se o arquivo de teste existe
    if (!fs.existsSync(TEST_FILE)) {
        console.log('❌ FALHA: Arquivo de teste NÃO ENCONTRADO!');
        console.log('');
        console.log('Isso significa que:');
        console.log('   1. O sistema de arquivos é efêmero (não persistente)');
        console.log('   2. Os arquivos são deletados a cada deploy/restart');
        console.log('');
        console.log('🔧 Solução: Configure um volume persistente no Railway');
        console.log('   Mount Path: /app/.wwebjs_auth');
        console.log('   Size: 1GB');
        return false;
    }

    // Ler o arquivo de teste
    const testData = JSON.parse(fs.readFileSync(TEST_FILE, 'utf8'));

    console.log('✅ SUCESSO: Arquivo de teste encontrado e lido!');
    console.log('');
    console.log('📊 Dados do arquivo:');
    console.log('   Criado em:', testData.timestamp);
    console.log('   Platform:', testData.platform);
    console.log('   Node:', testData.nodeVersion);
    console.log('   Diretório:', testData.cwd);
    console.log('   Mensagem:', testData.message);
    console.log('');

    // Calcular quanto tempo passou
    const created = new Date(testData.timestamp);
    const now = new Date();
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    console.log('⏱️  Tempo desde criação:');
    if (diffDays > 0) {
        console.log(`   ${diffDays} dia(s), ${diffHours % 24} hora(s), ${diffMins % 60} minuto(s)`);
    } else if (diffHours > 0) {
        console.log(`   ${diffHours} hora(s), ${diffMins % 60} minuto(s)`);
    } else {
        console.log(`   ${diffMins} minuto(s)`);
    }
    console.log('');

    console.log('🎉 PERSISTÊNCIA ESTÁ FUNCIONANDO!');
    console.log('   Seus dados de autenticação do WhatsApp devem persistir entre deploys.');

    return true;
}

function showUsage() {
    console.log('Uso:');
    console.log('  node check-persistence.js write   - Cria arquivo de teste');
    console.log('  node check-persistence.js read    - Verifica se arquivo persiste');
    console.log('  node check-persistence.js check   - Apenas verifica o diretório');
}

function checkDirectory() {
    console.log('🔍 Verificando diretório .wwebjs_auth...');
    console.log('');

    if (!fs.existsSync(AUTH_DIR)) {
        console.log('❌ Diretório NÃO EXISTE');
        return;
    }

    console.log('✅ Diretório existe:', AUTH_DIR);

    const stats = fs.statSync(AUTH_DIR);
    console.log('📊 Informações:');
    console.log('   Criado em:', stats.birthtime.toISOString());
    console.log('   Modificado em:', stats.mtime.toISOString());
    console.log('');

    const files = fs.readdirSync(AUTH_DIR);
    console.log(`📂 Arquivos (${files.length}):`);

    if (files.length === 0) {
        console.log('   (vazio)');
    } else {
        files.forEach(file => {
            const filePath = path.join(AUTH_DIR, file);
            const fileStats = fs.statSync(filePath);
            const size = fileStats.size;
            const sizeStr = size > 1024 ? `${(size / 1024).toFixed(2)} KB` : `${size} bytes`;
            console.log(`   - ${file} (${sizeStr})`);
        });
    }
}

// Main
const command = process.argv[2];

console.log('');
console.log('═'.repeat(60));
console.log('  🔍 Verificador de Persistência - Railway');
console.log('═'.repeat(60));
console.log('');

switch (command) {
    case 'write':
        writeTestFile();
        break;
    case 'read':
        readTestFile();
        break;
    case 'check':
        checkDirectory();
        break;
    default:
        showUsage();
}

console.log('');
