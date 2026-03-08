const { normalizeRelativeDate } = require('./date');

const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const moneyToNumber = (raw) => {
    if (!raw) return null;
    const source = String(raw).toLowerCase().trim();
    const hasMil = /\bmil\b/.test(source);
    const cleaned = source
        .replace(/r\$/g, '')
        .replace(/\s+/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^0-9.]/g, '');

    if (!cleaned) return null;
    const value = parseFloat(cleaned);
    if (!Number.isFinite(value)) return null;
    return hasMil ? value * 1000 : value;
};

const categoryRules = [
    { category: 'combustível', keywords: ['gasolina', 'etanol', 'diesel', 'combustivel', 'combustível'] },
    { category: 'alimentação', keywords: ['mercado', 'almoco', 'almoço', 'janta', 'jantar', 'lanche', 'restaurante', 'delivery', 'ifood', 'farmacia', 'farmácia'] },
    { category: 'transporte', keywords: ['uber', '99', 'taxi', 'ônibus', 'onibus', 'metro', 'metrô', 'passagem'] },
    { category: 'automóvel', keywords: ['carro', 'mecanico', 'mecânico', 'lavagem', 'oficina', 'pneu'] },
    { category: 'moradia', keywords: ['aluguel', 'condominio', 'condomínio', 'casa'] },
    { category: 'contas e serviços', keywords: ['internet', 'luz', 'agua', 'água', 'telefone', 'mensalidade'] },
    { category: 'saúde', keywords: ['medico', 'médico', 'consulta', 'exame', 'saude', 'saúde'] },
    { category: 'lazer', keywords: ['cinema', 'show', 'bar', 'viagem', 'lazer'] },
    { category: 'serviços', keywords: ['cliente', 'servico', 'serviço', 'freela', 'freelance', 'projeto'] },
    { category: 'salário', keywords: ['salario', 'salário', 'holerite'] },
    { category: 'investimentos', keywords: ['investimento', 'investimentos', 'aporte', 'cofrinho', 'rendimento', 'resgate'] }
];

const queryCategoryRules = [
    { category: 'alimentação', keywords: ['alimentacao', 'alimentação', 'mercado', 'restaurante'] },
    { category: 'combustível', keywords: ['gasolina', 'combustivel', 'combustível'] },
    { category: 'transporte', keywords: ['uber', 'transporte'] },
    { category: 'investimentos', keywords: ['investimento', 'investimentos'] }
];

const detectCategory = (text) => {
    const target = normalize(text);
    const match = categoryRules.find((rule) => rule.keywords.some((keyword) => target.includes(normalize(keyword))));
    return match ? match.category : 'outros';
};

const extractDescription = (text) => {
    return String(text || '')
        .replace(/\b(gastei|paguei|recebi|entrou|ganhei|lança|lanca|despesa|receita|com|de|do|da|ontem|hoje|amanhã|amanha)\b/gi, ' ')
        .replace(/\br\$\s*[\d.,]+\b/gi, ' ')
        .replace(/\b\d[\d.,]*\s*mil\b/gi, ' ')
        .replace(/\b\d[\d.,]*\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const queryIntent = (text) => {
    const target = normalize(text);
    if (!/(quanto|qual|listar|liste|mostre|saldo|gastei|gasto|recebi|despesa|despesas|receita|receitas)/.test(target)) {
        return null;
    }

    let metric = 'balance';
    if (/(gastei|gasto|despesa|despesas)/.test(target)) metric = 'expenses';
    if (/(recebi|receita|receitas|entrou)/.test(target)) metric = 'income';
    if (/(listar|liste|mostre)/.test(target)) metric = 'list';

    let period = 'month';
    if (/\bhoje\b/.test(target)) period = 'today';
    if (/\bontem\b/.test(target)) period = 'yesterday';
    if (/(mes|mês)/.test(target)) period = 'month';

    const categoryMatch = queryCategoryRules.find((rule) => rule.keywords.some((keyword) => target.includes(normalize(keyword))));

    return {
        type: 'query',
        metric,
        period,
        category: categoryMatch ? categoryMatch.category : null,
        description: text.trim(),
        confidence: metric === 'list' && !categoryMatch ? 0.62 : 0.88,
        used_ai: false
    };
};

const parseTransaction = (text) => {
    const target = normalize(text);
    const amountMatch = text.match(/(\d[\d.,]*\s*mil|\d[\d.,]*)/i);
    const amount = moneyToNumber(amountMatch ? amountMatch[1] : null);
    if (!amount) return null;

    let type = null;
    let confidence = 0.52;

    if (/\b(gastei|paguei|despesa|lan[çc]a)\b/.test(target)) {
        type = 'expense';
        confidence = 0.9;
    } else if (/\b(recebi|entrou|ganhei|receita)\b/.test(target)) {
        type = 'income';
        confidence = 0.9;
    } else if (/^[a-zà-ú0-9\s]+ \d/.test(text.trim()) || /\b(mercado|uber|gasolina|internet|farmacia|farmácia)\b/.test(target)) {
        type = 'expense';
        confidence = 0.76;
    }

    if (!type) return null;

    const description = extractDescription(text) || (type === 'income' ? 'Receita via WhatsApp' : 'Despesa via WhatsApp');
    const category = detectCategory(description || text);
    const date = normalizeRelativeDate(text);

    if (/\b(e|,)\b/.test(target) && /(mercado|farmacia|farmácia|uber|gasolina)/.test(target) && !/\bcom\b/.test(target)) {
        confidence = Math.min(confidence, 0.48);
    }

    return {
        type,
        amount,
        category,
        description,
        transaction_date: date,
        confidence,
        used_ai: false
    };
};

const interpretWithRules = (messageText) => {
    const query = queryIntent(messageText);
    if (query) return query;

    const transaction = parseTransaction(messageText);
    if (transaction) return transaction;

    return {
        type: 'unknown',
        amount: null,
        category: null,
        description: messageText.trim(),
        transaction_date: normalizeRelativeDate(messageText),
        confidence: 0.2,
        used_ai: false
    };
};

module.exports = {
    interpretWithRules,
    normalize,
    moneyToNumber
};
