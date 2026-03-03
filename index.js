const express = require('express');
const os = require('os');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3000;

// Utility to get local IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

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
    if (err.message.includes('UNIQUE constraint failed')) {
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
    const { darkMode } = req.body; // 'enabled' or 'disabled'
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
      if (r.type === 'receita') months[r.month].receitas = r.total;
      else months[r.month].despesas = r.total;
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

    res.json({ transactions, categoryTotals });
  } catch (err) {
    next(err);
  }
});

// --- API Metas ---
app.get('/api/goals', authenticate, async (req, res, next) => {
  try {
    const goals = await db.goals.allAsync(
      'SELECT * FROM goals WHERE user_id = ? ORDER BY createdAt DESC',
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
      `INSERT INTO goals (user_id, title, targetValue, currentValue, deadline, category, icon, color) 
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
      `UPDATE goals SET title = ?, targetValue = ?, currentValue = ?, deadline = ?, category = ?, icon = ?, color = ?
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

// Start Server (only if not running as a function)
if (require.main === module) {
  // Configurações locais para testes (só roda no seu PC)
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Horizonte Financeiro rodando em:`);
    console.log(`   - Local: http://localhost:${PORT}`);
    console.log(`   - Rede:  http://${localIP}:${PORT}\n`);
  });
}

// Export for Vercel
module.exports = app;
