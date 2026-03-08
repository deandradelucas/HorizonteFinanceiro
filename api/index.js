// ============================================================
// LEGEND: Este script pertence ao "Horizonte Financeiro"
// LEGEND (PT): API serverless para deploy no Vercel.
//   - Contém todas as rotas da API (mesmo conteúdo do server.js)
//   - Usado automaticamente pelo Vercel via vercel.json
//   - Inclui: autenticação, transações, metas, histórico
//   - Middleware de autenticação via header 'user-id'
// ============================================================
// api/index.js
// api/index.js
// api/index.js
const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();

// Middleware
app.use(express.json());

// Global Request Logger with Ultra Trace
app.use((req, res, next) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        console.log(`>>> [REQ] ${new Date().toISOString()} - ${req.method} ${fullUrl}`);
        next();
    } catch (err) {
        console.error('Error in request logger:', err);
        next();
    }
});

// Health check for Vercel with Diagnostics
app.get('/api/health', (req, res) => {
    const diagnostics = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        node_version: process.version,
        env: {
            hasUrl: !!process.env.SUPABASE_URL,
            hasKey: !!process.env.SUPABASE_KEY
        }
    };

    res.json(diagnostics);
});

// --- Middlewares Utilitários ---
const authenticate = (req, res, next) => {
    const userId = req.headers['user-id'];
    console.log(`[AUTH CHECK] Path: ${req.method} ${req.url}, user-id: ${userId}`);
    if (!userId) {
        console.warn('[AUTH FAILED] No user-id header provided');
        return res.status(401).json({ error: 'Não autorizado' });
    }
    req.userId = userId;
    next();
};

// --- API Autenticação ---
// Rota para registro de novos usuários e login
app.post('/api/register', async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const result = await db.users.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, password]
        );
        res.status(201).json({ id: result.id, message: 'Usuário cadastrado com sucesso!' });
    } catch (err) {
        const errorMsg = err.message || '';
        if (errorMsg.includes('UNIQUE constraint failed') || errorMsg.includes('duplicate key value')) {
            return res.status(400).json({ error: 'E-mail já cadastrado.' });
        }
        next(err);
    }
});

app.post('/api/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await db.users.getAsync(
            'SELECT id, name, email, darkmode, role, is_active FROM users WHERE email = ? AND password = ?',
            [email, password]
        );

        if (!user) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
        res.json(user);
    } catch (err) {
        next(err);
    }
});

app.put('/api/user/preferences', authenticate, async (req, res, next) => {
    try {
        const { darkMode } = req.body; // 'enabled' or 'disabled'
        await db.users.query(
            'UPDATE users SET darkmode = ? WHERE id = ?',
            [darkMode, req.userId]
        );
        res.json({ message: 'Preferências atualizadas com sucesso!' });
    } catch (err) {
        next(err);
    }
});

// --- API Transações ---
// Rotas para gerenciar receitas e despesas
app.get('/api/transactions', authenticate, async (req, res, next) => {
    try {
        const transactions = await db.transactions.allAsync(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC',
            [req.userId]
        );
        res.json(transactions);
    } catch (err) {
        next(err);
    }
});

app.post('/api/transactions', authenticate, async (req, res, next) => {
    try {
        console.log('[API] POST /api/transactions - Body:', JSON.stringify(req.body));
        const { type, description, value, category, date, isRecurring } = req.body;
        const result = await db.transactions.query(
            'INSERT INTO transactions (user_id, type, description, value, category, date, isRecurring) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.userId, type, description, value, category, date, isRecurring ? 1 : 0]
        );
        console.log('[API] Transaction Saved OK, ID:', result.id);
        res.status(201).json({ id: result.id, message: 'Transação salva com sucesso!' });
    } catch (err) {
        console.error(`[TRANSACTION ERROR] ${err.message}`);
        if (err.details) console.error(`Detalhamento: ${err.details}`);
        next(err);
    }
});

app.get('/api/transactions/:id', authenticate, async (req, res, next) => {
    try {
        const transaction = await db.transactions.getAsync(
            'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
            [req.params.id, req.userId]
        );
        if (!transaction) return res.status(404).json({ error: 'Transação não encontrada' });
        res.json(transaction);
    } catch (err) {
        next(err);
    }
});

app.put('/api/transactions/:id', authenticate, async (req, res, next) => {
    try {
        const { type, description, value, category, date, isRecurring } = req.body;
        await db.transactions.query(
            'UPDATE transactions SET type = ?, description = ?, value = ?, category = ?, date = ?, isRecurring = ? WHERE id = ? AND user_id = ?',
            [type, description, value, category, date, isRecurring ? 1 : 0, req.params.id, req.userId]
        );
        res.json({ message: 'Transação atualizada com sucesso!' });
    } catch (err) {
        next(err);
    }
});

app.delete('/api/transactions/:id', authenticate, async (req, res, next) => {
    try {
        await db.transactions.query(
            'DELETE FROM transactions WHERE id = ? AND user_id = ?',
            [req.params.id, req.userId]
        );
        res.json({ message: 'Transação excluída com sucesso!' });
    } catch (err) {
        next(err);
    }
});

// --- API Histórico ---
// Rotas para resumo mensal e detalhes por período
const normalizeTransactionType = (type) => {
    if (type === 'income' || type === 'receita') return 'income';
    if (type === 'expense' || type === 'despesa') return 'expense';
    return type;
};

app.get('/api/transactions/catalog', authenticate, async (req, res, next) => {
    try {
        const transactions = await db.transactions.allAsync(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC',
            [req.userId]
        );

        const catalog = {
            expense: {},
            income: {}
        };

        transactions.forEach((transaction) => {
            const type = normalizeTransactionType(transaction.type);
            if (type !== 'income' && type !== 'expense') return;

            const category = String(transaction.category || '').trim();
            const subcategory = String(transaction.description || '').trim();
            if (!category) return;

            if (!catalog[type][category]) {
                catalog[type][category] = {
                    category,
                    subcategories: []
                };
            }

            if (subcategory && !catalog[type][category].subcategories.includes(subcategory)) {
                catalog[type][category].subcategories.push(subcategory);
            }
        });

        res.json({
            expense: Object.values(catalog.expense),
            income: Object.values(catalog.income)
        });
    } catch (err) {
        next(err);
    }
});

const toSafeNumber = (value, fallback = 0) => {
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

app.get('/api/history/summary', authenticate, async (req, res, next) => {
    try {
        const { year } = req.query;
        if (!year) return res.status(400).json({ error: 'Ano é obrigatório' });

        const rows = await db.transactions.allAsync(
            `SELECT 
        substr(date, 6, 2) as month,
        type,
        SUM(value) as total
       FROM transactions 
       WHERE user_id = ? AND substr(date, 1, 4) = ?
       GROUP BY substr(date, 6, 2), type
       ORDER BY month`,
            [req.userId, year]
        );

        // Build monthly summary
        const months = {};
        for (let m = 1; m <= 12; m++) {
            const key = String(m).padStart(2, '0');
            months[key] = { month: key, receitas: 0, despesas: 0, saldo: 0 };
        }
        rows.forEach(r => {
            const normalizedType = normalizeTransactionType(r.type);
            const total = toSafeNumber(r.total);
            if (!months[r.month]) return;
            if (normalizedType === 'income') months[r.month].receitas = total;
            else if (normalizedType === 'expense') months[r.month].despesas = total;
        });
        Object.values(months).forEach(m => m.saldo = m.receitas - m.despesas);

        res.json(Object.values(months));
    } catch (err) {
        next(err);
    }
});

app.get('/api/history/details', authenticate, async (req, res, next) => {
    try {
        const { year, month, day } = req.query;
        if (!year || !month) return res.status(400).json({ error: 'Ano e mês são obrigatórios' });

        const datePrefix = day
            ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            : `${year}-${month.padStart(2, '0')}`;

        // Transactions for the period
        const transactions = await db.transactions.allAsync(
            `SELECT * FROM transactions 
       WHERE user_id = ? AND date LIKE ?
       ORDER BY date DESC, id DESC`,
            [req.userId, `${datePrefix}%`]
        );

        // Category totals
        const categoryTotals = await db.transactions.allAsync(
            `SELECT category, type, SUM(value) as total, COUNT(*) as count
       FROM transactions 
       WHERE user_id = ? AND date LIKE ?
       GROUP BY category, type
       ORDER BY total DESC`,
            [req.userId, `${datePrefix}%`]
        );

        const normalizedTransactions = transactions.map((transaction) => ({
            ...transaction,
            type: normalizeTransactionType(transaction.type),
            value: toSafeNumber(transaction.value)
        }));

        const normalizedCategoryTotals = categoryTotals.map((item) => ({
            ...item,
            type: normalizeTransactionType(item.type),
            total: toSafeNumber(item.total),
            count: Number.isFinite(item.count) ? item.count : parseInt(item.count, 10) || 0
        }));

        res.json({ transactions: normalizedTransactions, categoryTotals: normalizedCategoryTotals });
    } catch (err) {
        next(err);
    }
});

// --- API Metas ---
app.get('/api/goals', authenticate, async (req, res, next) => {
    try {
        const goals = await db.goals.allAsync(
            'SELECT * FROM goals WHERE user_id = ? ORDER BY createdat DESC',
            [req.userId]
        );
        res.json(goals);
    } catch (err) {
        next(err);
    }
});

app.post('/api/goals', authenticate, async (req, res, next) => {
    try {
        const { title, targetValue, currentValue, deadline, category, icon, color } = req.body;
        const result = await db.goals.query(
            `INSERT INTO goals (user_id, title, targetvalue, currentvalue, deadline, category, icon, color) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.userId, title, targetValue, currentValue || 0, deadline || null, category || 'geral', icon || 'fa-bullseye', color || '#0d9488']
        );
        res.status(201).json({ id: result.id, message: 'Meta criada com sucesso!' });
    } catch (err) {
        next(err);
    }
});

app.put('/api/goals/:id', authenticate, async (req, res, next) => {
    try {
        const { title, targetValue, currentValue, deadline, category, icon, color } = req.body;
        await db.goals.query(
            `UPDATE goals SET title = ?, targetvalue = ?, currentvalue = ?, deadline = ?, category = ?, icon = ?, color = ?
       WHERE id = ? AND user_id = ?`,
            [title, targetValue, currentValue, deadline, category, icon, color, req.params.id, req.userId]
        );
        res.json({ message: 'Meta atualizada com sucesso!' });
    } catch (err) {
        next(err);
    }
});

app.delete('/api/goals/:id', authenticate, async (req, res, next) => {
    try {
        await db.goals.query(
            'DELETE FROM goals WHERE id = ? AND user_id = ?',
            [req.params.id, req.userId]
        );
        res.json({ message: 'Meta excluída com sucesso!' });
    } catch (err) {
        next(err);
    }
});

// --- Middleware de Erro Centralizado ---
app.use((err, req, res, next) => {
    console.error(`[SERVER ERROR] ${err.message}`);
    res.status(500).json({
        error: 'Erro interno do servidor.',
        detalhe: err.message,
        caminho_tentado: req.originalUrl
    });
});

// --- Roteamento de Frontend (Prioridade para o Vercel) ---

// 1. Redirecionar raiz para login
app.get('/', (req, res) => {
    res.redirect('/login');
});

// 2. Mapear /register explicitamente
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// 3. Servir arquivos estáticos do frontend (Ajustado para ../public)
app.use(express.static(path.join(__dirname, '../public'), { extensions: ['html'] }));

// Fallback para index.html (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

module.exports = app;
