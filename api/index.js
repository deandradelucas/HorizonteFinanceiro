const express = require('express');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');

const app = express();
const SESSION_COOKIE_NAME = 'hf_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const SESSION_SECRET = process.env.APP_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || 'development-session-secret';
const supabase = db.supabase;

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
    try {
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        console.log(`>>> [REQ] ${new Date().toISOString()} - ${req.method} ${fullUrl}`);
        next();
    } catch (error) {
        console.error('Error in request logger:', error);
        next();
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        node_version: process.version,
        env: {
            hasUrl: !!process.env.SUPABASE_URL,
            hasKey: !!(process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY)
        }
    });
});

const parseCookies = (cookieHeader = '') => {
    return cookieHeader.split(';').reduce((acc, pair) => {
        const separatorIndex = pair.indexOf('=');
        if (separatorIndex === -1) return acc;
        const key = pair.slice(0, separatorIndex).trim();
        const value = pair.slice(separatorIndex + 1).trim();
        if (key) acc[key] = decodeURIComponent(value);
        return acc;
    }, {});
};

const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
};

const verifyPassword = (password, storedPassword) => {
    if (!storedPassword) return false;
    if (!storedPassword.startsWith('scrypt$')) return password === storedPassword;

    const [, salt, storedHash] = storedPassword.split('$');
    if (!salt || !storedHash) return false;

    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(computedHash, 'hex'));
};

const createSessionToken = (userId) => {
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const payload = `${userId}.${expiresAt}`;
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    return `${payload}.${signature}`;
};

const verifySessionToken = (token) => {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [userId, expiresAtRaw, signature] = parts;
    const payload = `${userId}.${expiresAtRaw}`;
    const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
        return null;
    }

    const expiresAt = parseInt(expiresAtRaw, 10);
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
        return null;
    }

    return { userId, expiresAt };
};

const setSessionCookie = (req, res, userId) => {
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    const parts = [
        `${SESSION_COOKIE_NAME}=${encodeURIComponent(createSessionToken(userId))}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${SESSION_TTL_SECONDS}`
    ];

    if (isSecure) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
};

const clearSessionCookie = (req, res) => {
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    const parts = [
        `${SESSION_COOKIE_NAME}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Max-Age=0'
    ];

    if (isSecure) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isValidIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const safeNumber = (value, fallback = 0) => {
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const normalizeTransactionType = (type) => {
    if (type === 'income' || type === 'receita') return 'income';
    if (type === 'expense' || type === 'despesa') return 'expense';
    if (type === 'investment' || type === 'investimento') return 'investment';
    return type;
};

const validateTransactionPayload = (payload = {}) => {
    const type = normalizeTransactionType(payload.type);
    const description = String(payload.description || '').trim();
    const category = String(payload.category || '').trim();
    const date = String(payload.date || '').trim();
    const value = safeNumber(payload.value, NaN);

    if (!['income', 'expense', 'investment'].includes(type)) return { error: 'Tipo de transação inválido.' };
    if (!description) return { error: 'Descrição é obrigatória.' };
    if (!category) return { error: 'Categoria é obrigatória.' };
    if (!isValidIsoDate(date)) return { error: 'Data inválida.' };
    if (!Number.isFinite(value) || value < 0) return { error: 'Valor inválido.' };

    return {
        value: {
            type,
            description,
            category,
            date,
            value,
            isRecurring: Boolean(payload.isRecurring)
        }
    };
};

const validateGoalPayload = (payload = {}) => {
    const title = String(payload.title || '').trim();
    const targetValue = safeNumber(payload.targetValue, NaN);
    const currentValue = safeNumber(payload.currentValue, 0);
    const deadline = payload.deadline ? String(payload.deadline).trim() : null;

    if (!title) return { error: 'Título da meta é obrigatório.' };
    if (!Number.isFinite(targetValue) || targetValue < 0) return { error: 'Valor alvo inválido.' };
    if (!Number.isFinite(currentValue) || currentValue < 0) return { error: 'Valor atual inválido.' };
    if (deadline && !isValidIsoDate(deadline)) return { error: 'Prazo inválido.' };

    return {
        value: {
            title,
            targetValue,
            currentValue,
            deadline,
            category: String(payload.category || 'geral').trim() || 'geral',
            icon: String(payload.icon || 'fa-bullseye').trim() || 'fa-bullseye',
            color: String(payload.color || '#0d9488').trim() || '#0d9488'
        }
    };
};

const authenticate = (req, res, next) => {
    const headerUserId = req.headers['user-id'];
    const cookies = parseCookies(req.headers.cookie || '');
    const session = verifySessionToken(cookies[SESSION_COOKIE_NAME]);
    console.log(`[AUTH CHECK] Path: ${req.method} ${req.url}, user-id: ${headerUserId}, has-session: ${!!session}`);

    if (!session) {
        return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
    }

    if (headerUserId && String(headerUserId) !== String(session.userId)) {
        return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
    }

    req.userId = session.userId;
    next();
};

const requireSupabase = () => {
    if (!supabase) {
        throw new Error('Supabase client not initialized. Check environment variables.');
    }
    return supabase;
};

const getUserByEmail = async (email) => {
    const client = requireSupabase();
    const { data, error } = await client
        .from('users')
        .select('id, name, email, password, password_hash, darkmode, role, is_active')
        .eq('email', email)
        .maybeSingle();

    if (error) throw error;
    return data;
};

app.post('/api/register', async (req, res, next) => {
    try {
        const name = String(req.body?.name || '').trim();
        const email = normalizeEmail(req.body?.email);
        const password = String(req.body?.password || '');

        if (!name) return res.status(400).json({ error: 'Nome é obrigatório.' });
        if (!isValidEmail(email)) return res.status(400).json({ error: 'E-mail inválido.' });
        if (password.length < 8) return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });

        const client = requireSupabase();
        const existingUser = await getUserByEmail(email);
        if (existingUser) return res.status(400).json({ error: 'E-mail já cadastrado.' });

        const passwordHash = hashPassword(password);
        const { data, error } = await client
            .from('users')
            .insert({ name, email, password: passwordHash, password_hash: passwordHash })
            .select('id')
            .single();

        if (error) throw error;
        res.status(201).json({ id: data.id, message: 'Usuário cadastrado com sucesso!' });
    } catch (error) {
        next(error);
    }
});

app.post('/api/login', async (req, res, next) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const password = String(req.body?.password || '');

        if (!isValidEmail(email) || !password) {
            return res.status(400).json({ error: 'Credenciais inválidas.' });
        }

        const client = requireSupabase();
        const user = await getUserByEmail(email);
        const storedSecret = user?.password_hash || user?.password;
        if (!user || !verifyPassword(password, storedSecret)) {
            return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
        }

        if (user.is_active === false) {
            return res.status(403).json({ error: 'Usuário desativado.' });
        }

        if (!String(user.password_hash || '').startsWith('scrypt$') || !String(user.password || '').startsWith('scrypt$')) {
            const passwordHash = hashPassword(password);
            await client
                .from('users')
                .update({ password: passwordHash, password_hash: passwordHash })
                .eq('id', user.id);
        }

        setSessionCookie(req, res, user.id);
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            darkMode: user.darkmode,
            role: user.role,
            is_active: user.is_active
        });
    } catch (error) {
        next(error);
    }
});

app.post('/api/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ message: 'Sessão encerrada com sucesso.' });
});

app.put('/api/user/preferences', authenticate, async (req, res, next) => {
    try {
        const darkMode = req.body?.darkMode;
        if (!['enabled', 'disabled'].includes(darkMode)) {
            return res.status(400).json({ error: 'Valor de tema inválido.' });
        }

        await db.users.query('UPDATE users SET darkmode = ? WHERE id = ?', [darkMode, req.userId]);
        res.json({ message: 'Preferências atualizadas com sucesso!' });
    } catch (error) {
        next(error);
    }
});

app.get('/api/transactions', authenticate, async (req, res, next) => {
    try {
        const transactions = await db.transactions.allAsync(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC',
            [req.userId]
        );
        res.json(transactions.map((item) => ({ ...item, value: safeNumber(item.value), type: normalizeTransactionType(item.type) })));
    } catch (error) {
        next(error);
    }
});

app.post('/api/transactions', authenticate, async (req, res, next) => {
    try {
        const parsed = validateTransactionPayload(req.body);
        if (parsed.error) return res.status(400).json({ error: parsed.error });

        const { type, description, value, category, date, isRecurring } = parsed.value;
        const result = await db.transactions.query(
            'INSERT INTO transactions (user_id, type, description, value, category, date, isRecurring) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.userId, type, description, value, category, date, isRecurring ? 1 : 0]
        );
        res.status(201).json({ id: result.id, message: 'Transação salva com sucesso!' });
    } catch (error) {
        next(error);
    }
});

app.get('/api/transactions/:id', authenticate, async (req, res, next) => {
    try {
        const transaction = await db.transactions.getAsync(
            'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
            [req.params.id, req.userId]
        );

        if (!transaction) return res.status(404).json({ error: 'Transação não encontrada.' });
        res.json({ ...transaction, value: safeNumber(transaction.value), type: normalizeTransactionType(transaction.type) });
    } catch (error) {
        next(error);
    }
});

app.put('/api/transactions/:id', authenticate, async (req, res, next) => {
    try {
        const parsed = validateTransactionPayload(req.body);
        if (parsed.error) return res.status(400).json({ error: parsed.error });

        const { type, description, value, category, date, isRecurring } = parsed.value;
        await db.transactions.query(
            'UPDATE transactions SET type = ?, description = ?, value = ?, category = ?, date = ?, isRecurring = ? WHERE id = ? AND user_id = ?',
            [type, description, value, category, date, isRecurring ? 1 : 0, req.params.id, req.userId]
        );
        res.json({ message: 'Transação atualizada com sucesso!' });
    } catch (error) {
        next(error);
    }
});

app.delete('/api/transactions/:id', authenticate, async (req, res, next) => {
    try {
        await db.transactions.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        res.json({ message: 'Transação excluída com sucesso!' });
    } catch (error) {
        next(error);
    }
});

app.get('/api/transactions/catalog', authenticate, async (req, res, next) => {
    try {
        const transactions = await db.transactions.allAsync(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC',
            [req.userId]
        );

        const catalog = { expense: {}, income: {}, investment: {} };
        transactions.forEach((transaction) => {
            const type = normalizeTransactionType(transaction.type);
            if (!catalog[type]) return;

            const category = String(transaction.category || '').trim();
            const subcategory = String(transaction.description || '').trim();
            if (!category) return;

            if (!catalog[type][category]) {
                catalog[type][category] = { category, subcategories: [] };
            }

            if (subcategory && !catalog[type][category].subcategories.includes(subcategory)) {
                catalog[type][category].subcategories.push(subcategory);
            }
        });

        res.json({
            expense: Object.values(catalog.expense),
            income: Object.values(catalog.income),
            investment: Object.values(catalog.investment)
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/history/summary', authenticate, async (req, res, next) => {
    try {
        const year = String(req.query.year || '').trim();
        if (!/^\d{4}$/.test(year)) return res.status(400).json({ error: 'Ano é obrigatório.' });

        const rows = await db.transactions.allAsync(
            `SELECT substr(date, 6, 2) as month, type, SUM(value) as total
             FROM transactions
             WHERE user_id = ? AND substr(date, 1, 4) = ?
             GROUP BY substr(date, 6, 2), type
             ORDER BY month`,
            [req.userId, year]
        );

        const months = {};
        for (let month = 1; month <= 12; month += 1) {
            const key = String(month).padStart(2, '0');
            months[key] = { month: key, receitas: 0, despesas: 0, saldo: 0 };
        }

        rows.forEach((row) => {
            const normalizedType = normalizeTransactionType(row.type);
            const total = safeNumber(row.total);
            if (!months[row.month]) return;
            if (normalizedType === 'income') months[row.month].receitas = total;
            else if (normalizedType === 'expense') months[row.month].despesas = total;
        });

        Object.values(months).forEach((item) => {
            item.saldo = item.receitas - item.despesas;
        });

        res.json(Object.values(months));
    } catch (error) {
        next(error);
    }
});

app.get('/api/history/details', authenticate, async (req, res, next) => {
    try {
        const year = String(req.query.year || '').trim();
        const month = String(req.query.month || '').trim();
        const day = req.query.day ? String(req.query.day).trim() : null;

        if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month)) {
            return res.status(400).json({ error: 'Ano e mês são obrigatórios.' });
        }
        if (day && !/^\d{1,2}$/.test(day)) {
            return res.status(400).json({ error: 'Dia inválido.' });
        }

        const datePrefix = day
            ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            : `${year}-${month.padStart(2, '0')}`;

        const transactions = await db.transactions.allAsync(
            `SELECT * FROM transactions
             WHERE user_id = ? AND date LIKE ?
             ORDER BY date DESC, id DESC`,
            [req.userId, `${datePrefix}%`]
        );

        const categoryTotals = await db.transactions.allAsync(
            `SELECT category, type, SUM(value) as total, COUNT(*) as count
             FROM transactions
             WHERE user_id = ? AND date LIKE ?
             GROUP BY category, type
             ORDER BY total DESC`,
            [req.userId, `${datePrefix}%`]
        );

        res.json({
            transactions: transactions.map((transaction) => ({
                ...transaction,
                type: normalizeTransactionType(transaction.type),
                value: safeNumber(transaction.value)
            })),
            categoryTotals: categoryTotals.map((item) => ({
                ...item,
                type: normalizeTransactionType(item.type),
                total: safeNumber(item.total),
                count: parseInt(item.count, 10) || 0
            }))
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/goals', authenticate, async (req, res, next) => {
    try {
        const goals = await db.goals.allAsync('SELECT * FROM goals WHERE user_id = ? ORDER BY createdat DESC', [req.userId]);
        res.json(goals);
    } catch (error) {
        next(error);
    }
});

app.post('/api/goals', authenticate, async (req, res, next) => {
    try {
        const parsed = validateGoalPayload(req.body);
        if (parsed.error) return res.status(400).json({ error: parsed.error });

        const { title, targetValue, currentValue, deadline, category, icon, color } = parsed.value;
        const result = await db.goals.query(
            `INSERT INTO goals (user_id, title, targetvalue, currentvalue, deadline, category, icon, color)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.userId, title, targetValue, currentValue, deadline, category, icon, color]
        );
        res.status(201).json({ id: result.id, message: 'Meta criada com sucesso!' });
    } catch (error) {
        next(error);
    }
});

app.put('/api/goals/:id', authenticate, async (req, res, next) => {
    try {
        const parsed = validateGoalPayload(req.body);
        if (parsed.error) return res.status(400).json({ error: parsed.error });

        const { title, targetValue, currentValue, deadline, category, icon, color } = parsed.value;
        await db.goals.query(
            `UPDATE goals SET title = ?, targetvalue = ?, currentvalue = ?, deadline = ?, category = ?, icon = ?, color = ?
             WHERE id = ? AND user_id = ?`,
            [title, targetValue, currentValue, deadline, category, icon, color, req.params.id, req.userId]
        );
        res.json({ message: 'Meta atualizada com sucesso!' });
    } catch (error) {
        next(error);
    }
});

app.delete('/api/goals/:id', authenticate, async (req, res, next) => {
    try {
        await db.goals.query('DELETE FROM goals WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        res.json({ message: 'Meta excluída com sucesso!' });
    } catch (error) {
        next(error);
    }
});

app.use((error, req, res, next) => {
    console.error(`[SERVER ERROR] ${error.message}`);
    const payload = { error: 'Erro interno do servidor.' };

    if (process.env.NODE_ENV !== 'production') {
        payload.detail = error.message;
        payload.path = req.originalUrl;
    }

    res.status(500).json(payload);
});

app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.use(express.static(path.join(__dirname, '../public'), { extensions: ['html'] }));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

module.exports = app;
