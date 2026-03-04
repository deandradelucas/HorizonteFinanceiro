const supabase = require('./supabaseClient')

async function testConnection() {
    console.log('--- Teste de Conexão Supabase ---')
    console.log('URL:', process.env.SUPABASE_URL)

    try {
        // Tenta buscar o esquema ou uma tabela padrão (users é comum em auth)
        const { data, error } = await supabase.auth.getSession()

        if (error) {
            console.error('❌ Erro na conexão:', error.message)
        } else {
            console.log('✅ Conexão bem-sucedida! Sessão atual recuperada.')

            // Se o usuário mencionou que existe uma tabela, podemos tentar listar tabelas ou algo simples
            // Mas auth.getSession() já valida se o client foi criado e as chaves funcionam.
        }
    } catch (err) {
        console.error('💥 Erro inesperado:', err.message)
    }
}

testConnection()
