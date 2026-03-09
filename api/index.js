const express = require('express');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');
const createWhatsAppRouter = require('./routes/whatsapp');
const createBillingRouter = require('./routes/billing');

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
const normalizePhone = (value) => String(value || '').replace(/\D+/g, '');
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
const normalizeFinancialScope = (scope) => {
    if (scope === 'pj' || scope === 'cnpj' || scope === 'business' || scope === 'empresa') return 'pj';
    return 'pf';
};

const validateTransactionPayload = (payload = {}) => {
    const type = normalizeTransactionType(payload.type);
    const description = String(payload.description || '').trim();
    const category = String(payload.category || '').trim();
    const date = String(payload.date || '').trim();
    const value = safeNumber(payload.value, NaN);
    const financialScope = normalizeFinancialScope(payload.financialScope);

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
            isRecurring: Boolean(payload.isRecurring),
            financialScope
        }
    };
};

const validateBusinessProfilePayload = (payload = {}) => {
    const companyName = String(payload.companyName || '').trim();
    const tradeName = String(payload.tradeName || '').trim();
    const cnpj = String(payload.cnpj || '').replace(/\D+/g, '');
    const taxRegime = String(payload.taxRegime || '').trim();
    const businessEmail = normalizeEmail(payload.businessEmail || '');
    const businessPhone = normalizePhone(payload.businessPhone || '');
    const notes = String(payload.notes || '').trim();

    if (!companyName) return { error: 'Razão social é obrigatória.' };
    if (cnpj && cnpj.length !== 14) return { error: 'CNPJ inválido.' };
    if (businessEmail && !isValidEmail(businessEmail)) return { error: 'E-mail empresarial inválido.' };
    if (businessPhone && businessPhone.length < 10) return { error: 'Telefone empresarial inválido.' };

    return {
        value: {
            company_name: companyName,
            trade_name: tradeName || null,
            cnpj: cnpj || null,
            tax_regime: taxRegime || null,
            business_email: businessEmail || null,
            business_phone: businessPhone || null,
            notes: notes || null
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
        .select('id, name, email, phone, password, password_hash, darkmode, role, is_active')
        .eq('email', email)
        .maybeSingle();

    if (error) throw error;
    return data;
};

const getUserByPhone = async (phone) => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return null;

    const client = requireSupabase();
    const { data, error } = await client
        .from('users')
        .select('id, name, email, phone, role, is_active')
        .eq('phone', normalizedPhone)
        .maybeSingle();

    if (error) throw error;
    return data;
};

const getUserById = async (userId) => {
    const client = requireSupabase();
    const { data, error } = await client
        .from('users')
        .select('id, name, email, phone, darkmode, role, is_active, last_login, created_at, updated_at, billing_exempt, subscription_status, subscription_plan_code, subscription_payment_method, subscription_next_due_date, billing_provider, asaas_customer_id, subscription_id')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw error;
    return data;
};

const getBusinessProfileByUserId = async (userId) => {
    const client = requireSupabase();
    const { data, error } = await client
        .from('business_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    return data;
};

const saveBusinessProfile = async (userId, payload) => {
    const client = requireSupabase();
    const existing = await getBusinessProfileByUserId(userId);
    const record = {
        user_id: userId,
        ...payload,
        updated_at: new Date().toISOString()
    };

    if (existing) {
        const { data, error } = await client
            .from('business_profiles')
            .update(record)
            .eq('id', existing.id)
            .select('*')
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    const { data, error } = await client
        .from('business_profiles')
        .insert({ ...record, created_at: new Date().toISOString() })
        .select('*')
        .maybeSingle();
    if (error) throw error;
    return data;
};

const sanitizeUser = (user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    role: user.role || 'user',
    is_active: user.is_active !== false,
    billing_exempt: user.billing_exempt === true,
    subscription_status: user.subscription_status || 'inactive',
    subscription_next_due_date: user.subscription_next_due_date || null,
    subscription_payment_method: user.subscription_payment_method || null,
    last_login: user.last_login || null,
    created_at: user.created_at || null,
    updated_at: user.updated_at || null
});

const requireSuperAdmin = async (req, res, next) => {
    try {
        const currentUser = await getUserById(req.userId);
        if (!currentUser || currentUser.role !== 'super_admin') {
            return res.status(403).json({ error: 'Acesso restrito ao super admin.' });
        }

        req.currentUser = currentUser;
        next();
    } catch (error) {
        next(error);
    }
};

const defaultPermissions = {
    dashboard: true,
    transactions: true,
    goals: true,
    reports: false,
    settings: false
};

const getUserPermissionsRecord = async (userId) => {
    const client = requireSupabase();
    const { data, error } = await client
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    return data;
};

const saveUserPermissionsRecord = async (userId, permissions) => {
    const client = requireSupabase();
    const existing = await getUserPermissionsRecord(userId);

    if (existing) {
        const { error } = await client
            .from('user_permissions')
            .update({ permissions })
            .eq('id', existing.id);
        if (error) throw error;
        return { ...existing, permissions };
    }

    const { data, error } = await client
        .from('user_permissions')
        .insert({ user_id: userId, permissions })
        .select('*')
        .single();
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

        if (!email || !password) {
            return res.status(400).json({ error: 'Credenciais inválidas.' });
        }

        const client = requireSupabase();
        const user = await getUserByEmail(email);
        const passwordMatches = user && (
            verifyPassword(password, user.password_hash) ||
            verifyPassword(password, user.password)
        );
        if (!user || !passwordMatches) {
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

        await client
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

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

app.get('/api/me', authenticate, async (req, res, next) => {
    try {
        const user = await getUserById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        res.json({
            ...sanitizeUser(user),
            darkMode: user.darkmode || 'disabled'
        });
    } catch (error) {
        next(error);
    }
});

app.put('/api/user/profile', authenticate, async (req, res, next) => {
    try {
        const name = String(req.body?.name || '').trim();
        const rawPhone = String(req.body?.phone || '').trim();
        const phone = rawPhone ? rawPhone.replace(/\D/g, '') : null;

        if (!name) {
            return res.status(400).json({ error: 'Nome é obrigatório.' });
        }

        if (phone && phone.length < 10) {
            return res.status(400).json({ error: 'Telefone inválido.' });
        }

        const client = requireSupabase();
        const { data, error } = await client
            .from('users')
            .update({
                name,
                phone,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.userId)
            .select('id, name, email, phone, darkmode, role, is_active, last_login, created_at, updated_at, billing_exempt, subscription_status, subscription_payment_method, subscription_next_due_date')
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        res.json({
            ...sanitizeUser(data),
            darkMode: data.darkmode || 'disabled'
        });
    } catch (error) {
        next(error);
    }
});

app.get('/api/business-profile', authenticate, async (req, res, next) => {
    try {
        const profile = await getBusinessProfileByUserId(req.userId);
        res.json(profile || null);
    } catch (error) {
        next(error);
    }
});

app.put('/api/business-profile', authenticate, async (req, res, next) => {
    try {
        const parsed = validateBusinessProfilePayload(req.body);
        if (parsed.error) return res.status(400).json({ error: parsed.error });

        const profile = await saveBusinessProfile(req.userId, parsed.value);
        res.json(profile);
    } catch (error) {
        next(error);
    }
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
        const financialScope = req.query.scope === 'all' ? 'all' : normalizeFinancialScope(req.query.scope);
        const transactions = await db.transactions.allAsync(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC',
            [req.userId]
        );
        const filtered = financialScope === 'all'
            ? transactions
            : transactions.filter((item) => normalizeFinancialScope(item.financial_scope) === financialScope);

        res.json(filtered.map((item) => ({
            ...item,
            value: safeNumber(item.value),
            type: normalizeTransactionType(item.type),
            financial_scope: normalizeFinancialScope(item.financial_scope)
        })));
    } catch (error) {
        next(error);
    }
});

app.post('/api/transactions', authenticate, async (req, res, next) => {
    try {
        const parsed = validateTransactionPayload(req.body);
        if (parsed.error) return res.status(400).json({ error: parsed.error });

        const { type, description, value, category, date, isRecurring, financialScope } = parsed.value;
        const result = await db.transactions.query(
            'INSERT INTO transactions (user_id, type, description, value, category, date, isRecurring, financial_scope) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [req.userId, type, description, value, category, date, isRecurring ? 1 : 0, financialScope]
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
        res.json({
            ...transaction,
            value: safeNumber(transaction.value),
            type: normalizeTransactionType(transaction.type),
            financial_scope: normalizeFinancialScope(transaction.financial_scope)
        });
    } catch (error) {
        next(error);
    }
});

app.put('/api/transactions/:id', authenticate, async (req, res, next) => {
    try {
        const parsed = validateTransactionPayload(req.body);
        if (parsed.error) return res.status(400).json({ error: parsed.error });

        const { type, description, value, category, date, isRecurring, financialScope } = parsed.value;
        await db.transactions.query(
            'UPDATE transactions SET type = ?, description = ?, value = ?, category = ?, date = ?, isRecurring = ?, financial_scope = ? WHERE id = ? AND user_id = ?',
            [type, description, value, category, date, isRecurring ? 1 : 0, financialScope, req.params.id, req.userId]
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

app.get('/api/transaction-catalog', authenticate, async (req, res, next) => {
    try {
        const client = requireSupabase();
        const { data, error } = await client
            .from('transaction_catalogs')
            .select('financial_scope, transaction_type, category, subcategory, sort_order')
            .order('sort_order', { ascending: true })
            .order('category', { ascending: true })
            .order('subcategory', { ascending: true });

        if (error) throw error;

        const catalog = {
            pf: { expense: [], income: [], investment: [] },
            pj: { expense: [], income: [], investment: [] }
        };

        (data || []).forEach((item) => {
            const scope = normalizeFinancialScope(item.financial_scope);
            const type = normalizeTransactionType(item.transaction_type);
            if (!catalog[scope] || !catalog[scope][type]) return;

            let categoryRecord = catalog[scope][type].find((entry) => entry.category === item.category);
            if (!categoryRecord) {
                categoryRecord = { category: item.category, subcategories: [] };
                catalog[scope][type].push(categoryRecord);
            }

            if (!categoryRecord.subcategories.includes(item.subcategory)) {
                categoryRecord.subcategories.push(item.subcategory);
            }
        });

        res.json(catalog);
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
            if (req.query.scope && req.query.scope !== 'all' && normalizeFinancialScope(transaction.financial_scope) !== normalizeFinancialScope(req.query.scope)) {
                return;
            }

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

app.get('/api/admin/stats', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const client = requireSupabase();
        const { data, error } = await client
            .from('users')
            .select('id, is_active, last_login, updated_at');
        if (error) throw error;

        const now = Date.now();
        const fifteenMinutesAgo = now - (15 * 60 * 1000);
        const today = new Date().toISOString().slice(0, 10);
        const users = data || [];
        const stats = {
            total: users.length,
            online: users.filter((user) => user.last_login && new Date(user.last_login).getTime() >= fifteenMinutesAgo).length,
            blocked: users.filter((user) => user.is_active === false).length,
            actionsToday: users.filter((user) => (user.updated_at || '').slice(0, 10) === today).length
        };

        res.json(stats);
    } catch (error) {
        next(error);
    }
});

app.get('/api/admin/users', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const client = requireSupabase();
        const { data, error } = await client
            .from('users')
            .select('id, name, email, phone, role, is_active, billing_exempt, subscription_status, subscription_next_due_date, subscription_payment_method, last_login, created_at, updated_at')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json((data || []).map(sanitizeUser));
    } catch (error) {
        next(error);
    }
});

app.post('/api/admin/users', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const name = String(req.body?.name || '').trim();
        const email = normalizeEmail(req.body?.email);
        const phone = normalizePhone(req.body?.phone);
        const password = String(req.body?.password || '');
        const role = ['super_admin', 'admin', 'user'].includes(req.body?.role) ? req.body.role : 'user';
        const billingExempt = req.body?.billing_exempt === true || role === 'super_admin';

        if (!isValidEmail(email)) return res.status(400).json({ error: 'E-mail inválido.' });
        if (password.length < 8) return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres.' });
        if (phone && phone.length < 10) return res.status(400).json({ error: 'Telefone inválido.' });
        if (await getUserByEmail(email)) return res.status(400).json({ error: 'E-mail já cadastrado.' });
        if (phone && await getUserByPhone(phone)) return res.status(400).json({ error: 'Telefone já cadastrado.' });

        const passwordHash = hashPassword(password);
        const client = requireSupabase();
        const { data, error } = await client
            .from('users')
            .insert({
                name,
                email,
                phone: phone || null,
                role,
                is_active: true,
                billing_exempt: billingExempt,
                subscription_status: billingExempt ? 'active' : 'inactive',
                subscription_plan_code: billingExempt ? 'super_admin_override' : null,
                subscription_payment_method: billingExempt ? 'free' : null,
                password: passwordHash,
                password_hash: passwordHash
            })
            .select('id, name, email, phone, role, is_active, billing_exempt, subscription_status, subscription_next_due_date, subscription_payment_method, last_login, created_at, updated_at')
            .single();
        if (error) throw error;

        res.status(201).json(sanitizeUser(data));
    } catch (error) {
        next(error);
    }
});

app.put('/api/admin/users/:id/role', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Usuário inválido.' });

        const role = ['super_admin', 'admin', 'user'].includes(req.body?.role) ? req.body.role : null;
        const is_active = typeof req.body?.is_active === 'boolean' ? req.body.is_active : undefined;
        const billing_exempt = typeof req.body?.billing_exempt === 'boolean' ? req.body.billing_exempt : undefined;
        const name = Object.prototype.hasOwnProperty.call(req.body || {}, 'name') ? String(req.body?.name || '').trim() : undefined;
        const phone = Object.prototype.hasOwnProperty.call(req.body || {}, 'phone') ? normalizePhone(req.body?.phone) : undefined;
        if (!role) return res.status(400).json({ error: 'Role inválida.' });
        if (phone && phone.length < 10) return res.status(400).json({ error: 'Telefone inválido.' });
        if (phone) {
            const existingPhoneUser = await getUserByPhone(phone);
            if (existingPhoneUser && existingPhoneUser.id !== targetId) {
                return res.status(400).json({ error: 'Telefone já cadastrado.' });
            }
        }
        if (targetId === req.currentUser.id && role !== 'super_admin') {
            return res.status(400).json({ error: 'O super admin atual não pode remover o próprio acesso.' });
        }

        const patch = { role };
        if (typeof is_active === 'boolean') patch.is_active = is_active;
        if (typeof billing_exempt === 'boolean') patch.billing_exempt = billing_exempt;
        if (name !== undefined) patch.name = name;
        if (phone !== undefined) patch.phone = phone || null;
        if (role === 'super_admin') {
            patch.billing_exempt = true;
            patch.subscription_status = 'active';
            patch.subscription_plan_code = 'super_admin_free';
            patch.subscription_payment_method = 'free';
        } else if (billing_exempt === true) {
            patch.subscription_status = 'active';
            patch.subscription_plan_code = 'super_admin_override';
            patch.subscription_payment_method = 'free';
        } else if (billing_exempt === false) {
            patch.subscription_payment_method = req.body?.subscription_payment_method || 'pix';
            patch.subscription_plan_code = null;
        }

        const client = requireSupabase();
        const { data, error } = await client
            .from('users')
            .update(patch)
            .eq('id', targetId)
            .select('id, name, email, phone, role, is_active, billing_exempt, subscription_status, subscription_next_due_date, subscription_payment_method, last_login, created_at, updated_at')
            .single();
        if (error) throw error;

        res.json(sanitizeUser(data));
    } catch (error) {
        next(error);
    }
});

app.post('/api/admin/users/:id/block', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Usuário inválido.' });
        if (targetId === req.currentUser.id) return res.status(400).json({ error: 'Você não pode bloquear sua própria conta.' });

        const client = requireSupabase();
        const { error } = await client.from('users').update({ is_active: false }).eq('id', targetId);
        if (error) throw error;
        res.json({ message: 'Usuário bloqueado com sucesso.' });
    } catch (error) {
        next(error);
    }
});

app.post('/api/admin/users/:id/unblock', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Usuário inválido.' });

        const client = requireSupabase();
        const { error } = await client.from('users').update({ is_active: true }).eq('id', targetId);
        if (error) throw error;
        res.json({ message: 'Usuário desbloqueado com sucesso.' });
    } catch (error) {
        next(error);
    }
});

app.put('/api/admin/users/:id/billing', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Usuário inválido.' });

        const nextDueDateRaw = req.body?.subscription_next_due_date;
        const patch = {};

        if (typeof req.body?.billing_exempt === 'boolean') patch.billing_exempt = req.body.billing_exempt;

        if (req.body?.subscription_status) {
            const allowed = ['inactive', 'pending', 'checkout_pending', 'active', 'past_due', 'cancelled'];
            if (!allowed.includes(req.body.subscription_status)) {
                return res.status(400).json({ error: 'Status de assinatura inválido.' });
            }
            patch.subscription_status = req.body.subscription_status;
        }

        if (req.body?.subscription_payment_method) {
            const allowedMethods = ['pix', 'credit_card', 'free'];
            if (!allowedMethods.includes(req.body.subscription_payment_method)) {
                return res.status(400).json({ error: 'Método de pagamento inválido.' });
            }
            patch.subscription_payment_method = req.body.subscription_payment_method;
        }

        if (nextDueDateRaw !== undefined) {
            const nextDueDate = String(nextDueDateRaw || '').trim();
            if (nextDueDate && !isValidIsoDate(nextDueDate)) {
                return res.status(400).json({ error: 'Data de vencimento inválida.' });
            }
            patch.subscription_next_due_date = nextDueDate || null;
        }

        if (patch.billing_exempt === true) {
            patch.subscription_status = 'active';
            patch.subscription_plan_code = 'super_admin_override';
            patch.subscription_payment_method = patch.subscription_payment_method || 'free';
        }

        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ error: 'Nenhuma alteração de cobrança foi enviada.' });
        }

        patch.updated_at = new Date().toISOString();

        const client = requireSupabase();
        const { data, error } = await client
            .from('users')
            .update(patch)
            .eq('id', targetId)
            .select('id, name, email, phone, role, is_active, billing_exempt, subscription_status, subscription_next_due_date, subscription_payment_method, last_login, created_at, updated_at')
            .single();
        if (error) throw error;

        res.json(sanitizeUser(data));
    } catch (error) {
        next(error);
    }
});

app.get('/api/admin/permissions', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const client = requireSupabase();
        const { data, error } = await client
            .from('users')
            .select('id, email, role')
            .order('email', { ascending: true });
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        next(error);
    }
});

app.get('/api/admin/permissions/:id', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Usuário inválido.' });

        const record = await getUserPermissionsRecord(targetId);
        res.json({ permissions: record?.permissions || defaultPermissions });
    } catch (error) {
        next(error);
    }
});

app.put('/api/admin/users/:id/permissions', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Usuário inválido.' });
        const permissions = req.body?.permissions;
        if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
            return res.status(400).json({ error: 'Permissions inválidas.' });
        }

        const saved = await saveUserPermissionsRecord(targetId, permissions);
        res.json(saved);
    } catch (error) {
        next(error);
    }
});

app.get('/api/admin/online-users', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const client = requireSupabase();
        const cutoffIso = new Date(Date.now() - (15 * 60 * 1000)).toISOString();
        const { data, error } = await client
            .from('users')
            .select('id, email, role, last_login')
            .gte('last_login', cutoffIso)
            .order('last_login', { ascending: false });
        if (error) throw error;

        res.json((data || []).map((user) => ({
            id: user.id,
            email: user.email,
            role: user.role || 'user',
            last_activity: user.last_login
        })));
    } catch (error) {
        next(error);
    }
});

app.post('/api/admin/users/:id/disconnect', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Usuário inválido.' });

        const client = requireSupabase();
        const { error } = await client.from('users').update({ last_login: null }).eq('id', targetId);
        if (error) throw error;
        res.json({ message: 'Sessão revogada.' });
    } catch (error) {
        next(error);
    }
});

app.get('/api/admin/activity-logs', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const client = requireSupabase();
        const [usersResult, permissionsResult] = await Promise.all([
            client.from('users').select('id, email, role, is_active, created_at, updated_at, last_login').order('updated_at', { ascending: false }),
            client.from('user_permissions').select('id, user_id, permissions, updated_at').order('updated_at', { ascending: false })
        ]);
        if (usersResult.error) throw usersResult.error;
        if (permissionsResult.error) throw permissionsResult.error;

        const userMap = new Map((usersResult.data || []).map((user) => [user.id, user]));
        const logs = [];

        (usersResult.data || []).forEach((user) => {
            if (user.created_at) {
                logs.push({
                    id: `user-created-${user.id}`,
                    action: 'Usuário registrado',
                    description: `Conta de ${user.email} criada no sistema.`,
                    user_id: user.id,
                    user_email: user.email,
                    created_at: user.created_at
                });
            }
            if (user.updated_at && user.updated_at !== user.created_at) {
                logs.push({
                    id: `user-updated-${user.id}`,
                    action: user.is_active === false ? 'Usuário bloqueado' : 'Usuário atualizado',
                    description: `Última atualização da conta ${user.email}. Role atual: ${user.role}.`,
                    user_id: user.id,
                    user_email: user.email,
                    created_at: user.updated_at
                });
            }
            if (user.last_login) {
                logs.push({
                    id: `user-login-${user.id}`,
                    action: 'Login realizado',
                    description: `${user.email} iniciou sessão.`,
                    user_id: user.id,
                    user_email: user.email,
                    created_at: user.last_login
                });
            }
        });

        (permissionsResult.data || []).forEach((entry) => {
            const user = userMap.get(entry.user_id);
            logs.push({
                id: `permissions-${entry.id}`,
                action: 'Permissões atualizadas',
                description: `Permissões em JSON atualizadas para ${user?.email || `usuário ${entry.user_id}`}.`,
                user_id: entry.user_id,
                user_email: user?.email || 'Desconhecido',
                created_at: entry.updated_at
            });
        });

        logs.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        res.json(logs.slice(0, 100));
    } catch (error) {
        next(error);
    }
});

app.post('/api/admin/ai-execute', authenticate, requireSuperAdmin, async (req, res, next) => {
    try {
        const prompt = String(req.body?.prompt || '').trim();
        if (!prompt) return res.status(400).json({ error: 'Prompt é obrigatório.' });

        const normalizedPrompt = prompt.toLowerCase();
        const client = requireSupabase();
        const { data: users, error } = await client.from('users').select('id, email, role, is_active');
        if (error) throw error;

        const matchedUser = (users || []).find((user) => normalizedPrompt.includes(String(user.email || '').toLowerCase()));
        if (!matchedUser) {
            return res.status(400).json({ error: 'Não encontrei um usuário citado no comando.' });
        }

        if (/(bloquear|block)/.test(normalizedPrompt)) {
            if (matchedUser.id === req.currentUser.id) return res.status(400).json({ error: 'Você não pode bloquear sua própria conta.' });
            await client.from('users').update({ is_active: false }).eq('id', matchedUser.id);
            return res.json({ action: 'Bloqueio', message: `${matchedUser.email} foi bloqueado.` });
        }

        if (/(desbloquear|unblock)/.test(normalizedPrompt)) {
            await client.from('users').update({ is_active: true }).eq('id', matchedUser.id);
            return res.json({ action: 'Desbloqueio', message: `${matchedUser.email} foi desbloqueado.` });
        }

        if (/(isentar cobranca|isentar cobrança|liberar cobranca|liberar cobrança|free)/.test(normalizedPrompt)) {
            await client.from('users').update({
                billing_exempt: true,
                subscription_status: 'active',
                subscription_payment_method: 'free',
                updated_at: new Date().toISOString()
            }).eq('id', matchedUser.id);
            return res.json({ action: 'Cobrança liberada', message: `${matchedUser.email} ficou isento de cobrança.` });
        }

        if (/(super admin|promover.*super_admin|promover.*super admin)/.test(normalizedPrompt)) {
            await client.from('users').update({ role: 'super_admin' }).eq('id', matchedUser.id);
            return res.json({ action: 'Role Atualizada', message: `${matchedUser.email} agora é super admin.` });
        }

        if (/(promover|admin)/.test(normalizedPrompt)) {
            await client.from('users').update({ role: 'admin' }).eq('id', matchedUser.id);
            return res.json({ action: 'Role Atualizada', message: `${matchedUser.email} agora é admin.` });
        }

        if (/(rebaixar|remover admin|user padrão|user padrao)/.test(normalizedPrompt)) {
            await client.from('users').update({ role: 'user' }).eq('id', matchedUser.id);
            return res.json({ action: 'Role Atualizada', message: `${matchedUser.email} agora é user.` });
        }

        return res.status(400).json({ error: 'Comando não reconhecido. Tente bloquear, desbloquear ou alterar role.' });
    } catch (error) {
        next(error);
    }
});

app.use('/api', createBillingRouter({ authenticate, getUserById }));
app.use('/api', createWhatsAppRouter({ authenticate, requireSuperAdmin }));

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
