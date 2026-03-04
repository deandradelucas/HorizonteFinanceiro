const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

if (!supabase) {
    console.warn('AVISO: Supabase não inicializado. Verifique as variáveis de ambiente.');
}

// Helper factory to mirror the old SQLite API (query, getAsync, allAsync)
const createSupabaseProxy = (table) => ({
    query: async (sql, params = []) => {
        console.log(`[DB QUERY] SQL: ${sql.substring(0, 50)}... Params:`, params);
        if (!supabase) {
            console.error('Supabase client not initialized');
            throw new Error('Erro de conexão com o banco de dados.');
        }

        if (sql.toLowerCase().includes('insert into users')) {
            const { data, error } = await supabase
                .from('users')
                .insert({ name: params[0], email: params[1], password: params[2] })
                .select()
                .single();
            if (error) throw error;
            if (!data) throw new Error('Falha ao inserir usuário: Nenhun dado retornado.');
            return { id: data.id };
        }

        if (sql.toLowerCase().includes('update users set darkmode')) {
            const { error } = await supabase
                .from('users')
                .update({ darkmode: params[0] })
                .eq('id', params[1]);
            if (error) throw error;
            return { changes: 1 };
        }

        if (sql.toLowerCase().includes('insert into transactions')) {
            const { data, error } = await supabase
                .from('transactions')
                .insert({
                    user_id: params[0],
                    type: params[1],
                    description: params[2],
                    value: params[3],
                    category: params[4],
                    date: params[5],
                    isrecurring: params[6] === 1
                })
                .select()
                .single();
            if (error) throw error;
            return { id: data.id };
        }

        if (sql.toLowerCase().includes('update transactions set')) {
            const { error } = await supabase
                .from('transactions')
                .update({
                    type: params[0],
                    description: params[1],
                    value: params[2],
                    category: params[3],
                    date: params[4],
                    isrecurring: params[5] === 1
                })
                .eq('id', params[6])
                .eq('user_id', params[7]);
            if (error) throw error;
            return { changes: 1 };
        }

        if (sql.toLowerCase().includes('delete from transactions')) {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', params[0])
                .eq('user_id', params[1]);
            if (error) throw error;
            return { changes: 1 };
        }

        if (sql.toLowerCase().includes('insert into goals')) {
            const { data, error } = await supabase
                .from('goals')
                .insert({
                    user_id: params[0],
                    title: params[1],
                    targetvalue: params[2],
                    currentvalue: params[3],
                    deadline: params[4],
                    category: params[5],
                    icon: params[6],
                    color: params[7]
                })
                .select()
                .single();
            if (error) throw error;
            return { id: data.id };
        }

        if (sql.toLowerCase().includes('update goals set')) {
            const { error } = await supabase
                .from('goals')
                .update({
                    title: params[0],
                    targetvalue: params[1],
                    currentvalue: params[2],
                    deadline: params[3],
                    category: params[4],
                    icon: params[5],
                    color: params[6]
                })
                .eq('id', params[7])
                .eq('user_id', params[8]);
            if (error) throw error;
            return { changes: 1 };
        }

        if (sql.toLowerCase().includes('delete from goals')) {
            const { error } = await supabase
                .from('goals')
                .delete()
                .eq('id', params[0])
                .eq('user_id', params[1]);
            if (error) throw error;
            return { changes: 1 };
        }

        throw new Error(`Query não suportada pelo proxy Supabase: ${sql}`);
    },

    getAsync: async (sql, params = []) => {
        if (!supabase) return null;
        if (sql.toLowerCase().includes('from users where email = ?')) {
            const { data, error } = await supabase
                .from('users')
                .select('id, name, email, darkmode')
                .eq('email', params[0])
                .eq('password', params[1])
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (data) {
                return {
                    id: data.id,
                    name: data.name,
                    email: data.email,
                    darkMode: data.darkmode
                };
            }
            return null;
        }

        if (sql.toLowerCase().includes('from transactions where id = ?')) {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', params[0])
                .eq('user_id', params[1])
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return data;
        }

        throw new Error(`getAsync não suportado pelo proxy Supabase: ${sql}`);
    },

    allAsync: async (sql, params = []) => {
        if (!supabase) return [];
        if (sql.toLowerCase().includes('from transactions where user_id = ? order by date desc')) {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', params[0])
                .order('date', { ascending: false })
                .order('id', { ascending: false });
            if (error) throw error;
            return data;
        }

        if (sql.toLowerCase().includes('select substr(date, 6, 2) as month')) {
            // Summary for history
            const { data, error } = await supabase
                .from('transactions')
                .select('date, type, value')
                .eq('user_id', params[0]);

            if (error) throw error;

            // Manual grouping because Supabase client doesn't support substr in select easily
            const filtered = data.filter(t => t.date.startsWith(params[1]));
            const grouped = {};
            filtered.forEach(t => {
                const month = t.date.substring(5, 7);
                const key = `${month}-${t.type}`;
                if (!grouped[key]) grouped[key] = { month, type: t.type, total: 0 };
                grouped[key].total += t.value;
            });
            return Object.values(grouped);
        }

        if (sql.toLowerCase().includes('from transactions where user_id = ? and date like ?')) {
            // History details
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', params[0])
                .like('date', params[1])
                .order('date', { ascending: false })
                .order('id', { ascending: false });
            if (error) throw error;

            if (sql.toLowerCase().includes('group by category, type')) {
                // Secondary query for category totals
                const groups = {};
                data.forEach(t => {
                    const key = `${t.category}-${t.type}`;
                    if (!groups[key]) groups[key] = { category: t.category, type: t.type, total: 0, count: 0 };
                    groups[key].total += t.value;
                    groups[key].count += 1;
                });
                return Object.values(groups).sort((a, b) => b.total - a.total);
            }

            return data;
        }

        if (sql.toLowerCase().includes('from goals where user_id = ?')) {
            const { data, error } = await supabase
                .from('goals')
                .select('*')
                .eq('user_id', params[0])
                .order('createdat', { ascending: false });
            if (error) throw error;
            return data;
        }

        throw new Error(`allAsync não suportado pelo proxy Supabase: ${sql}`);
    }
});

module.exports = {
    users: createSupabaseProxy('users'),
    transactions: createSupabaseProxy('transactions'),
    goals: createSupabaseProxy('goals'),
    supabase // Exporting raw client just in case
};
