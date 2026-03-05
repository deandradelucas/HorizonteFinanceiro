// ============================================================
// 🚀 STARTUP.JS - Assistente de Configuração do Horizonte Financeiro
// ============================================================
//
// O QUE ESSE ARQUIVO FAZ?
//   Esse script é o "checklist de pré-voo" do seu projeto.
//   Toda vez que você rodar "npm run dev" ou "npm start", ele verifica
//   se TUDO que o projeto precisa está instalado e configurado.
//
//   Se algo estiver faltando, ele te diz EXATAMENTE o que fazer
//   e em alguns casos até pede pra você digitar a informação ali mesmo.
//
// COMO FUNCIONA?
//   Ele passa por 6 etapas, na ordem:
//     1. Node.js instalado?
//     2. Dependências (node_modules) instaladas?
//     3. Arquivo .env com credenciais do banco?
//     4. Conexão com o banco de dados (Supabase) funcionando?
//     5. Git (controle de versão) configurado?
//     6. Vercel (hospedagem na nuvem) vinculada?
//
// SE ALGO FALHAR:
//   O script PARA e te mostra o que precisa ser feito.
//   Ele NÃO avança para a próxima etapa se a atual falhar.
//
// ============================================================

// --- Imports (bibliotecas que usamos) ---
const { execSync } = require('child_process');  // Para rodar comandos do terminal dentro do JS
const fs = require('fs');                       // Para ler e escrever arquivos
const path = require('path');                   // Para montar caminhos de pastas/arquivos
const readline = require('readline');           // Para ler o que o usuário digita no terminal

// ============================================================
// FUNÇÕES AUXILIARES
// Essas funções são "ferramentas" reutilizáveis que os passos
// de verificação usam. Elas ficam aqui em cima para manter
// o código organizado.
// ============================================================

/**
 * perguntarNoTerminal(pergunta)
 * 
 * Faz uma pergunta no terminal e espera você digitar a resposta.
 * Funciona assim: o programa PARA, mostra a pergunta, e só continua
 * depois que você digitar algo e apertar Enter.
 * 
 * Exemplo de uso:
 *   const nome = await perguntarNoTerminal('Qual seu nome? ');
 *   console.log(`Olá, ${nome}!`);
 */
function perguntarNoTerminal(pergunta) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(pergunta, (resposta) => {
            rl.close();
            resolve(resposta.trim());
        });
    });
}

/**
 * comandoExiste(comando)
 *
 * Testa se um programa está instalado no computador.
 * Roda o comando silenciosamente e retorna true/false.
 * 
 * Exemplo: comandoExiste('git --version') => true se o git estiver instalado
 */
function comandoExiste(comando) {
    try {
        execSync(comando, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * pegarVersao(comando)
 *
 * Roda um comando como "node -v" e retorna o texto de saída.
 * Se falhar, retorna 'desconhecida'.
 */
function pegarVersao(comando) {
    try {
        return execSync(comando).toString().trim();
    } catch {
        return 'desconhecida';
    }
}

// ============================================================
// FUNÇÃO PRINCIPAL: runPreflightChecks()
// 
// Essa é a função que orquestra tudo. Ela chama cada passo
// na ordem certa e só avança se o anterior passou.
// ============================================================
async function runPreflightChecks() {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  🚀 Horizonte Financeiro - Assistente de Setup        ║');
    console.log('║  Vamos verificar se está tudo pronto para rodar!      ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');

    // ----------------------------------------------------------
    // PASSO 1: Verificar se o Node.js está instalado
    // ----------------------------------------------------------
    //
    // O QUE É NODE.JS?
    //   Node.js é o "motor" que roda código JavaScript fora do navegador.
    //   Sem ele, nada funciona. É como uma tomada para o projeto.
    //
    // COMO INSTALAR?
    //   Baixe de: https://nodejs.org (pegue a versão LTS - mais estável)
    //   Depois de instalar, feche e abra o terminal de novo.
    //
    // ----------------------------------------------------------
    process.stdout.write('📦 [1/6] Node.js instalado?................ ');

    if (!comandoExiste('node -v')) {
        console.log('❌ NÃO ENCONTRADO');
        console.log('');
        console.log('   O Node.js não está instalado neste computador.');
        console.log('   Siga os passos abaixo:');
        console.log('');
        console.log('   1. Acesse: https://nodejs.org');
        console.log('   2. Clique no botão verde (versão LTS)');
        console.log('   3. Instale normalmente (Next, Next, Finish)');
        console.log('   4. FECHE este terminal e abra um novo');
        console.log('   5. Rode novamente: npm run dev');
        console.log('');
        process.exit(1);
    }

    const nodeVersion = pegarVersao('node -v');
    const npmVersion = pegarVersao('npm -v');
    console.log(`✅ OK (Node ${nodeVersion} | npm ${npmVersion})`);

    // ----------------------------------------------------------
    // PASSO 2: Verificar se as dependências estão instaladas
    // ----------------------------------------------------------
    //
    // O QUE SÃO DEPENDÊNCIAS?
    //   São bibliotecas (código pronto) que outras pessoas criaram
    //   e que nosso projeto usa. Por exemplo:
    //     - express    → cria o servidor web
    //     - dotenv     → lê o arquivo .env com as senhas
    //     - supabase   → conecta com o banco de dados na nuvem
    //
    // ONDE FICAM?
    //   Na pasta "node_modules". Essa pasta é ENORME e nunca vai
    //   para o GitHub (por isso está no .gitignore).
    //
    // COMO INSTALAR?
    //   Basta rodar "npm install" no terminal. O npm lê o arquivo
    //   package.json e baixa tudo que está listado lá.
    //
    // ----------------------------------------------------------
    process.stdout.write('📁 [2/6] Dependências instaladas?.......... ');

    const nodeModulesPath = path.join(process.cwd(), 'node_modules');

    if (!fs.existsSync(nodeModulesPath)) {
        console.log('❌ NÃO ENCONTRADO');
        console.log('');
        console.log('   A pasta "node_modules" não existe.');
        console.log('   Isso significa que as bibliotecas ainda não foram baixadas.');
        console.log('');

        const resposta = await perguntarNoTerminal('   Deseja instalar agora? (s/n): ');

        if (resposta.toLowerCase() === 's' || resposta.toLowerCase() === 'sim') {
            console.log('');
            console.log('   ⏳ Instalando dependências... (pode levar 1-2 minutos)');
            console.log('');
            try {
                execSync('npm install', { stdio: 'inherit', cwd: process.cwd() });
                console.log('');
                console.log('   ✅ Dependências instaladas com sucesso!');
            } catch (err) {
                console.log('   ❌ Falha na instalação. Tente manualmente: npm install');
                process.exit(1);
            }
        } else {
            console.log('');
            console.log('   Para instalar manualmente depois, rode: npm install');
            process.exit(1);
        }
    } else {
        // Verifica se os pacotes principais existem dentro do node_modules
        const pacotesPrincipais = ['express', 'dotenv', '@supabase/supabase-js'];
        const faltando = pacotesPrincipais.filter(pkg => {
            return !fs.existsSync(path.join(nodeModulesPath, pkg));
        });

        if (faltando.length > 0) {
            console.log('⚠️  INCOMPLETO');
            console.log(`   Pacotes faltando: ${faltando.join(', ')}`);
            const resposta = await perguntarNoTerminal('   Deseja rodar "npm install" para corrigir? (s/n): ');

            if (resposta.toLowerCase() === 's' || resposta.toLowerCase() === 'sim') {
                console.log('   ⏳ Instalando...');
                try {
                    execSync('npm install', { stdio: 'inherit', cwd: process.cwd() });
                    console.log('   ✅ Corrigido!');
                } catch (err) {
                    console.log('   ❌ Falha. Tente manualmente: npm install');
                    process.exit(1);
                }
            } else {
                process.exit(1);
            }
        } else {
            console.log('✅ OK');
        }
    }

    // ----------------------------------------------------------
    // PASSO 3: Verificar arquivo .env (credenciais secretas)
    // ----------------------------------------------------------
    //
    // O QUE É O ARQUIVO .env?
    //   É um arquivo de texto simples onde guardamos informações
    //   SECRETAS que o código precisa para funcionar, como:
    //     - URL do banco de dados
    //     - Chave de acesso ao banco
    //     - Porta do servidor
    //
    // POR QUE É SECRETO?
    //   Porque ele contém SENHAS. Se alguém pegar sua chave do
    //   Supabase, pode acessar e apagar seu banco de dados inteiro.
    //   Por isso o .env está no .gitignore (nunca vai pro GitHub).
    //
    // ONDE ENCONTRAR AS CREDENCIAIS DO SUPABASE?
    //   1. Acesse: https://supabase.com/dashboard
    //   2. Clique no seu projeto
    //   3. Vá em: Settings (⚙️) → API
    //   4. Copie:
    //      - "Project URL" → é a SUPABASE_URL
    //      - "service_role secret" → é a SUPABASE_KEY
    //
    // FORMATO DO ARQUIVO .env:
    //   SUPABASE_URL="https://xxxxx.supabase.co"
    //   SUPABASE_KEY="eyJhbGciOi..."
    //   PORT=3000
    //
    // ----------------------------------------------------------
    process.stdout.write('🔑 [3/6] Arquivo .env configurado?......... ');

    const envPath = path.join(process.cwd(), '.env');
    let envModificado = false;

    if (!fs.existsSync(envPath)) {
        console.log('❌ NÃO ENCONTRADO');
        console.log('');
        console.log('   O arquivo .env não existe. Vamos criá-lo agora!');
        console.log('');
        console.log('   ╔══════════════════════════════════════════════════╗');
        console.log('   ║  ONDE ENCONTRAR ESSAS INFORMAÇÕES:              ║');
        console.log('   ║                                                  ║');
        console.log('   ║  1. Acesse: https://supabase.com/dashboard      ║');
        console.log('   ║  2. Clique no seu projeto                       ║');
        console.log('   ║  3. Vá em: Settings (⚙️) → API                  ║');
        console.log('   ║  4. Copie a "Project URL" e "service_role key"  ║');
        console.log('   ╚══════════════════════════════════════════════════╝');
        console.log('');

        const supabaseUrl = await perguntarNoTerminal('   Cole a SUPABASE_URL (ex: https://xxx.supabase.co): ');
        const supabaseKey = await perguntarNoTerminal('   Cole a SUPABASE_KEY (chave grande que começa com eyJ...): ');
        const porta = await perguntarNoTerminal('   Porta do servidor (aperte Enter para usar 3000): ');

        const conteudoEnv = [
            `SUPABASE_URL="${supabaseUrl}"`,
            `SUPABASE_KEY="${supabaseKey}"`,
            `PORT=${porta || '3000'}`,
            '',
        ].join('\n');

        fs.writeFileSync(envPath, conteudoEnv);
        envModificado = true;
        console.log('');
        console.log('   ✅ Arquivo .env criado com sucesso!');
        console.log('');
    } else {
        // O arquivo existe, mas vamos checar se as variáveis estão lá dentro
        const envConteudo = fs.readFileSync(envPath, 'utf-8');

        const temURL = envConteudo.includes('SUPABASE_URL');
        const temKey = envConteudo.includes('SUPABASE_KEY') || envConteudo.includes('SUPABASE_SERVICE_ROLE');

        if (!temURL || !temKey) {
            console.log('⚠️  INCOMPLETO');
            console.log('');
            console.log('   O arquivo .env existe, mas está faltando:');
            if (!temURL) console.log('   - SUPABASE_URL (a URL do seu projeto no Supabase)');
            if (!temKey) console.log('   - SUPABASE_KEY (a chave de acesso ao banco)');
            console.log('');
            console.log('   Vá em: https://supabase.com/dashboard → Seu Projeto → Settings → API');
            console.log('');

            if (!temURL) {
                const url = await perguntarNoTerminal('   Cole a SUPABASE_URL: ');
                fs.appendFileSync(envPath, `\nSUPABASE_URL="${url}"`);
                envModificado = true;
            }
            if (!temKey) {
                const key = await perguntarNoTerminal('   Cole a SUPABASE_KEY: ');
                fs.appendFileSync(envPath, `\nSUPABASE_KEY="${key}"`);
                envModificado = true;
            }

            if (envModificado) {
                console.log('   ✅ .env atualizado!');
            }
        } else {
            console.log('✅ OK');
        }
    }

    // ----------------------------------------------------------
    // PASSO 4: Testar a conexão real com o banco de dados
    // ----------------------------------------------------------
    //
    // O QUE É O SUPABASE?
    //   É o nosso banco de dados na nuvem. Pense nele como uma
    //   planilha gigante que guarda todos os dados dos usuários,
    //   transações e metas. Ele fica online 24h e qualquer pessoa
    //   usando o site acessa os mesmos dados.
    //
    // POR QUE TESTAR?
    //   Porque mesmo tendo as credenciais no .env, elas podem
    //   estar erradas, ou o Supabase pode estar fora do ar.
    //   Melhor descobrir AGORA do que quando o usuário tentar
    //   fazer login e der erro.
    //
    // ----------------------------------------------------------
    process.stdout.write('🗄️  [4/6] Conexão com o Supabase?.......... ');

    // Se o .env foi criado/modificado agora, precisamos recarregar
    // as variáveis de ambiente, porque o dotenv já rodou lá no início
    if (envModificado) {
        require('dotenv').config({ override: true });
    } else {
        require('dotenv').config();
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.log('❌ FALHOU');
        console.log('');
        console.log('   As variáveis SUPABASE_URL ou SUPABASE_KEY estão vazias no .env.');
        console.log('   Abra o arquivo .env na raiz do projeto e preencha-as.');
        process.exit(1);
    }

    try {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Faz uma consulta rápida só pra testar se a conexão funciona
        const { data, error } = await supabase.from('users').select('id').limit(1);
        if (error) throw error;

        console.log('✅ OK');
    } catch (err) {
        console.log('❌ FALHOU');
        console.log('');
        console.log('   Não foi possível conectar ao banco de dados.');
        console.log(`   Erro: ${err.message}`);
        console.log('');
        console.log('   Possíveis causas:');
        console.log('   1. SUPABASE_URL ou SUPABASE_KEY estão erradas no .env');
        console.log('   2. O projeto do Supabase está pausado (acesse o dashboard)');
        console.log('   3. Sem conexão com a internet');
        console.log('');
        console.log('   Dashboard: https://supabase.com/dashboard');
        process.exit(1);
    }

    // ----------------------------------------------------------
    // PASSO 5: Verificar o Git (controle de versão)
    // ----------------------------------------------------------
    //
    // O QUE É O GIT?
    //   Git é o "Ctrl+Z profissional" para programadores.
    //   Ele salva uma fotografia do seu código a cada "commit".
    //   Se algo quebrar, você volta no tempo para quando funcionava.
    //
    // O QUE É O GITHUB?
    //   É o "Google Drive do código". Seu código fica salvo online
    //   no GitHub para que você (ou sua equipe) possa acessar de
    //   qualquer lugar. Se seu computador pegar fogo, o código
    //   ainda está seguro lá.
    //
    // COMO CONFIGURAR?
    //   1. Instale o Git: https://git-scm.com/downloads
    //   2. Na pasta do projeto, rode: git init
    //   3. Conecte ao GitHub:
    //      git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
    //
    // COMANDOS BÁSICOS DO DIA A DIA:
    //   git add .             → "seleciona" todos os arquivos modificados
    //   git commit -m "msg"   → "salva o progresso" com uma mensagem
    //   git push              → "envia" para o GitHub (nuvem)
    //   git status            → mostra o que mudou desde o último save
    //
    // ----------------------------------------------------------
    process.stdout.write('🐙 [5/6] Git configurado?.................. ');

    if (!comandoExiste('git --version')) {
        console.log('❌ NÃO INSTALADO');
        console.log('');
        console.log('   O Git não está instalado no seu computador.');
        console.log('');
        console.log('   Instalação:');
        console.log('   1. Acesse: https://git-scm.com/downloads');
        console.log('   2. Baixe a versão para Windows');
        console.log('   3. Instale (pode deixar tudo padrão)');
        console.log('   4. FECHE e abra o terminal novamente');
        console.log('   5. Rode de novo: npm run dev');
        console.log('');
        // Git não é obrigatório para rodar, então só avisa
    } else {
        // Verifica se a pasta tem um repositório git inicializado
        const temGit = comandoExiste('git rev-parse --is-inside-work-tree');

        if (!temGit) {
            console.log('⚠️  NÃO INICIALIZADO');
            console.log('');
            console.log('   O Git está instalado, mas não foi ativado nesta pasta.');

            const resposta = await perguntarNoTerminal('   Deseja ativar o Git neste projeto agora? (s/n): ');

            if (resposta.toLowerCase() === 's' || resposta.toLowerCase() === 'sim') {
                try {
                    execSync('git init', { cwd: process.cwd(), stdio: 'ignore' });
                    console.log('   ✅ Git inicializado! Agora você pode salvar versões do código.');
                    console.log('   Dica: seu primeiro commit pode ser feito assim:');
                    console.log('         git add .');
                    console.log('         git commit -m "Primeiro commit"');
                } catch {
                    console.log('   ❌ Erro ao inicializar o Git. Tente manualmente: git init');
                }
            }
        } else {
            // Git ativo! Vamos checar se tem remote (GitHub) conectado
            try {
                const remoteURL = execSync('git config --get remote.origin.url').toString().trim();
                const gitVersion = pegarVersao('git --version');
                console.log(`✅ OK (${gitVersion})`);
                console.log(`      └─ GitHub: ${remoteURL}`);
            } catch {
                console.log('⚠️  PARCIAL');
                console.log('   Git está ativo localmente, mas sem conexão com o GitHub.');
                console.log('');
                console.log('   Para conectar ao GitHub (salvar código na nuvem):');
                console.log('   1. Crie um repositório em: https://github.com/new');
                console.log('   2. Rode: git remote add origin https://github.com/SEU_USER/SEU_REPO.git');
                console.log('   3. Envie: git push -u origin main');
            }
        }
    }

    // ----------------------------------------------------------
    // PASSO 6: Verificar a integração com a Vercel (hospedagem)
    // ----------------------------------------------------------
    //
    // O QUE É A VERCEL?
    //   É o serviço que coloca seu site "no ar" na internet.
    //   Quando você faz deploy na Vercel, qualquer pessoa do mundo
    //   pode acessar seu site por um link tipo: meusite.vercel.app
    //
    // COMO FUNCIONA?
    //   1. Você cria uma conta gratuita em: https://vercel.com
    //   2. Instala a CLI: npm i -g vercel
    //   3. Vincula o projeto: npx vercel link
    //   4. Faz deploy: npx vercel --prod
    //
    // O QUE É O ARQUIVO .vercel/project.json?
    //   Quando você roda "npx vercel link", ele cria essa pasta
    //   invisível com as informações do seu projeto na nuvem.
    //   É assim que o computador sabe PARA ONDE enviar o código.
    //
    // ----------------------------------------------------------
    process.stdout.write('▲  [6/6] Vercel vinculada?................. ');

    const vercelConfigPath = path.join(process.cwd(), '.vercel', 'project.json');

    if (fs.existsSync(vercelConfigPath)) {
        try {
            const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));
            console.log(`✅ OK (Projeto: ${vercelConfig.projectName || 'Desconhecido'})`);
        } catch {
            console.log('✅ OK');
        }
    } else {
        console.log('⚠️  NÃO VINCULADO');
        console.log('');
        console.log('   O projeto não está vinculado à Vercel localmente.');
        console.log('   Isso não impede de rodar localmente, mas você não');
        console.log('   conseguirá publicar o site na internet sem isso.');
        console.log('');
        console.log('   Para vincular:');
        console.log('   1. Tenha uma conta em: https://vercel.com');
        console.log('   2. Rode no terminal: npx vercel link');
        console.log('   3. Siga as instruções na tela');
    }

    // ----------------------------------------------------------
    // FIM - Resumo
    // ----------------------------------------------------------
    //
    // Se chegou aqui, significa que os passos OBRIGATÓRIOS (1-4)
    // passaram. Os passos 5 e 6 (Git e Vercel) são opcionais
    // para rodar localmente, mas super recomendados.
    //
    // A partir daqui, o package.json chama o próximo comando:
    //   - "npm run dev"  → roda com nodemon (recarrega sozinho)
    //   - "npm start"    → roda direto com node (produção)
    //
    // ----------------------------------------------------------
    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  🟢 Tudo verificado! Iniciando a aplicação...         ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('');
}

// Roda a função principal
runPreflightChecks();
