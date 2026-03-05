require('dotenv').config();
const { supabase } = require('./db');

async function testConnection() {
    console.log('Testando conexão com o Supabase...');
    console.log('URL:', process.env.SUPABASE_URL ? 'Configurada' : 'Não configurada');
    console.log('Key:', process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE ? 'Configurada' : 'Não configurada');

    if (!supabase) {
        console.error('Erro: Cliente Supabase não inicializado no db.js.');
        return;
    }

    try {
        // Tenta buscar informações da tabela users
        console.log('\n--- Buscando Usuários ---');
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, name, email')
            .limit(3);

        if (usersError) {
            console.error('Erro ao buscar usuários:', usersError.message);
        } else {
            console.log('Conexão bem-sucedida!');
            console.log(users.length > 0 ? users : 'Nenhum usuário encontrado (tabela vazia).');
        }

        // Tenta buscar informações da tabela transactions
        console.log('\n--- Buscando Transações ---');
        const { data: transactions, error: txError } = await supabase
            .from('transactions')
            .select('id, description, value')
            .limit(3);

        if (txError) {
            console.error('Erro ao buscar transações:', txError.message);
        } else {
            console.log(transactions.length > 0 ? transactions : 'Nenhuma transação encontrada (tabela vazia).');
        }

    } catch (err) {
        console.error('Exceção ao testar banco de dados:', err);
    }
}

testConnection();
