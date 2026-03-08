const db = require('../../db');

const supabase = db.supabase;

const requireSupabase = () => {
    if (!supabase) {
        throw new Error('Supabase client not initialized.');
    }
    return supabase;
};

const getSaoPauloNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

const formatCurrency = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const getPeriodBounds = (period) => {
    const now = getSaoPauloNow();
    const today = now.toISOString().slice(0, 10);

    if (period === 'yesterday') {
        const previous = new Date(now);
        previous.setDate(previous.getDate() - 1);
        const date = previous.toISOString().slice(0, 10);
        return { from: date, to: date, label: 'ontem' };
    }

    if (period === 'month') {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const from = `${year}-${month}-01`;
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        return { from, to, label: 'neste mês' };
    }

    return { from: today, to: today, label: 'hoje' };
};

const executeFinancialQuery = async ({ userId, metric, period = 'today', category }) => {
    const client = requireSupabase();
    const bounds = getPeriodBounds(period);
    let query = client
        .from('transactions')
        .select('type, value, category, description, date')
        .eq('user_id', userId)
        .gte('date', bounds.from)
        .lte('date', bounds.to)
        .order('date', { ascending: false });

    if (category) {
        query = query.ilike('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const expenses = rows.filter((row) => row.type === 'expense');
    const incomes = rows.filter((row) => row.type === 'income');
    const investments = rows.filter((row) => row.type === 'investment');

    const expenseTotal = expenses.reduce((sum, row) => sum + Number(row.value || 0), 0);
    const incomeTotal = incomes.reduce((sum, row) => sum + Number(row.value || 0), 0);
    const investmentTotal = investments.reduce((sum, row) => sum + Number(row.value || 0), 0);

    if (metric === 'income') {
        return `Você recebeu ${formatCurrency(incomeTotal)} ${bounds.label}.`;
    }

    if (metric === 'balance') {
        const balance = incomeTotal - expenseTotal - investmentTotal;
        return `Seu saldo ${bounds.label} está em ${formatCurrency(balance)}.`;
    }

    if (metric === 'list') {
        if (expenses.length === 0) {
            return category
                ? `Não encontrei despesas em ${category} ${bounds.label}.`
                : `Não encontrei despesas ${bounds.label}.`;
        }

        const lines = expenses.slice(0, 5).map((row) => `- ${row.description}: ${formatCurrency(row.value)} em ${row.date}`);
        const header = category
            ? `Despesas de ${category} ${bounds.label}:`
            : `Suas despesas ${bounds.label}:`;
        return [header, ...lines].join('\n');
    }

    return `Você gastou ${formatCurrency(expenseTotal)} ${bounds.label}.`;
};

module.exports = {
    executeFinancialQuery,
    getPeriodBounds,
    formatCurrency,
    getSaoPauloNow
};
