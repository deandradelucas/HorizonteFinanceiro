require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

async function runPreflightChecks() {
    console.log('========================================================');
    console.log('🚀 Horizon Financeiro - Verificação de Inicialização');
    console.log('========================================================\n');

    /**
     * PASSO 1: Verificar Variáveis de Ambiente (.env)
     * O arquivo .env é uma pasta secreta onde guardamos senhas e chaves de acesso.
     * Nós precisamos garantir que as chaves de conexão com nosso banco de dados (Supabase)
     * estejam lá antes de prosseguir.
     */
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

    /**
     * PASSO 2: Testar a Conexão Real com o Banco de Dados (Supabase)
     * Não basta apenas ter a chave; precisamos testar se a chave funciona.
     * Aqui, nós conectamos ao banco e tentamos pegar apenas 1 registro rápido 
     * da tabela de usuários para "pegar no pulso" e ver se o banco está vivo.
     */
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

    /**
     * PASSO 3: Verificar Integração com a Plataforma de Hospedagem (Vercel)
     * A Vercel é onde o site fica salvo para todo mundo acessar (o "servidor na nuvem").
     * Quando você digita "npx vercel link", ele cria uma pastinha invisível chamada .vercel.
     * Aqui testamos se essa pasta existe para garantir que o projeto sabe pra ondem ir 
     * no momento de publicar o site online.
     */
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
        console.log('   Para vincular e poder fazer deploys no futuro, rode o comando: npx vercel link');
    }

    /**
     * PASSO 4: Verificar Controle de Versões (Git / GitHub)
     * O Git é o "botão de salvar o progresso" do seu código, estilo videogame.
     * Ele guarda todo o histórico e te ajuda a não perder código caso algo quebre.
     * O GitHub é o site onde esse histórico fica guardado online.
     * Aqui nós checamos se o Git está iniciado na pasta e se tem conexão com o GitHub.
     */
    process.stdout.write('🐙 4. Verificando Controle de Versões (Git)... ');
    try {
        // Tenta rodar um comando do git para checar se a pasta atual tem git
        execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });

        // Se funcionou, verifica se já está conectado ao GitHub da nuvem (chamado de remote origin)
        try {
            const originURL = execSync('git config --get remote.origin.url').toString().trim();
            console.log(`✅ OK (Conectado em: ${originURL})`);
        } catch (e) {
            console.log('⚠️  AVISO: Repositório Git local sem GitHub (remote origin) configurado.');
        }

    } catch (e) {
        console.log('⚠️  AVISO');
        console.log('   A pasta atual ainda não possui o Git ativado.');
        console.log('   Se quiser salvar o histórico do projeto, rode: git init');
    }

    /**
     * FIM: Tudo Certo!
     * Se os passos 1 e 2 passaram (os principais), ele inicia a aplicação real de fato!
     */
    console.log('\n🟢 Tudo pronto! Iniciando a aplicação...\n');
    console.log('========================================================');
}

runPreflightChecks();
