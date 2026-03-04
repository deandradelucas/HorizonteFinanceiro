// api/index.js
const express = require('express');
const path = require('path');
const db = require('../db');

const app = express();

// Middleware
app.use(express.json());

// --- Middlewares Utilitários ---
const authenticate = (req, res, next) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: 'Não autorizado' });
    req.userId = userId;
    next();
};

// --- API Autenticação ---
app.post('/api/register', async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const result = await db.users.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, password]
        );
        res.status(201).json({ id: result.id, message: 'Usuário cadastrado com sucesso!' });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'E-mail já cadastrado.' });
        }
        next(err);
    }
});

app.post('/api/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await db.users.getAsync(
            'SELECT id, name, email, darkMode FROM users WHERE email = ? AND password = ?',
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
        const { darkMode } = req.body;
        await db.users.query(
            'UPDATE users SET darkMode = ? WHERE id = ?',
            [darkMode, req.userId]
        );
        res.json({ message: 'Preferências atualizadas com sucesso!' });
    } catch (err) {
        next(err);
    }
});

// --- API Transações ---
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
        const { type, description, value, category, date, isRecurring } = req.body;
        const result = await db.transactions.query(
            'INSERT INTO transactions (user_id, type, description, value, category, date, isRecurring) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.userId, type, description, value, category, date, isRecurring ? 1 : 0]
        );
        res.status(201).json({ id: result.id, message: 'Transação salva com sucesso!' });
    } catch (err) {
        next(err);
    }
});

// Outras rotas permanecem iguais, apenas adaptadas se necessário
// ... (Omitido para brevidade, mas deve conter todas as rotas de index.js)

// --- Middleware de Erro Centralizado ---
app.use((err, req, res, next) => {
    console.error(`[SERVER ERROR] ${err.message}`);
    res.status(500).json({
        error: 'Erro interno do servidor.',
        detalhe: err.message,
        caminho_tentado: req.originalUrl
    });
});

// Export for Vercel
module.exports = app;
