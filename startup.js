require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function runPreflightChecks() {
    console.log('========================================================');
    console.log('🚀 Horizon Financeiro - Verificação de Inicialização');
    console.log('========================================================\n');

    // 1. Verificar Variáveis de Ambiente
    process.stdout.write('📦 1. Verificando Variáveis de Ambiente... ');
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.log('❌ FALHOU');
        console.error('\nErro: Variáveis SUPABASE_URL ou SUPABASE_KEY não foram encontradas no arquivo .env.');
        console.error('Por favor, configure o seu arquivo .env antes de rodar a aplicação.');
        process.exit(1);
    }
    console.log('✅ OK');

    // 2. Verificar Conexão com o Supabase
    process.stdout.write('🗄️  2. Testando Conexão com o Supabase... ');
    const supabase = createClient(url, key);
    try {
        const { error } = await supabase.from('users').select('id').limit(1);
        if (error) throw error;
        console.log('✅ OK');
    } catch (err) {
        console.log('❌ FALHOU');
        console.error('\nErro ao conectar com o banco de dados:', err.message);
        console.error('Verifique se as suas credenciais no .env estão corretas ou se o Supabase está online.');
        process.exit(1);
    }

    // 3. Verificando Integração com a Vercel
    process.stdout.write('▲  3. Verificando Integração com a Vercel... ');
    const fs = require('fs');
    const path = require('path');
    const vercelConfigPath = path.join(process.cwd(), '.vercel', 'project.json');

    if (fs.existsSync(vercelConfigPath)) {
        try {
            const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));
            console.log(`✅ OK (Projeto: ${vercelConfig.projectName || 'Desconhecido'})`);
        } catch (e) {
            console.log('✅ OK');
        }
    } else {
        console.log('⚠️  AVISO');
        console.log('   O projeto não está vinculado à Vercel localmente.');
        console.log('   Para vincular e poder fazer deploys, rode o comando: npx vercel link');
    }

    console.log('\n🟢 Tudo pronto! Iniciando a aplicação...\n');
    console.log('========================================================');
}

runPreflightChecks();
