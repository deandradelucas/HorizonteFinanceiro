const { normalizeRelativeDate } = require('./date');
const { moneyToNumber } = require('./parser');

const isAiConfigured = () => {
    const key = String(process.env.OPENAI_API_KEY || '').trim();
    return Boolean(key && !/sua_chave_real_aqui/i.test(key));
};

const clampConfidence = (value) => {
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(1, parsed));
};

const normalizeAiJson = (payload = {}, originalMessage) => {
    const type = ['expense', 'income', 'investment', 'query'].includes(payload.type) ? payload.type : 'unknown';
    const amount = moneyToNumber(payload.amount);
    return {
        type,
        amount: Number.isFinite(amount) ? amount : null,
        category: String(payload.category || '').trim().toLowerCase() || null,
        description: String(payload.description || '').trim() || originalMessage,
        transaction_date: payload.transaction_date || normalizeRelativeDate(originalMessage),
        confidence: clampConfidence(payload.confidence),
        used_ai: true,
        raw_ai_output: payload
    };
};

const extractJson = (text) => {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        return JSON.parse(match[0]);
    } catch (error) {
        return null;
    }
};

const interpretWithAI = async (messageText) => {
    if (!isAiConfigured()) return null;

    const prompt = [
        'Interprete a mensagem abaixo como uma movimentação financeira pessoal.',
        'Responda somente JSON válido com as chaves:',
        'type, amount, category, description, transaction_date, confidence.',
        'type deve ser um de: expense, income, investment, query, unknown.',
        'confidence deve ser um número entre 0 e 1.',
        'Se a mensagem for ambígua ou insuficiente, retorne confidence baixa.',
        `Mensagem: """${String(messageText || '').trim()}"""`
    ].join('\n');

    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
            input: prompt,
            temperature: 0.1
        })
    });

    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(raw?.error?.message || 'OpenAI request failed.');
        error.status = response.status;
        error.payload = raw;
        throw error;
    }

    const outputText = typeof raw.output_text === 'string' && raw.output_text
        ? raw.output_text
        : Array.isArray(raw.output)
        ? raw.output
            .flatMap((item) => item.content || [])
            .map((item) => item.text || '')
            .join('\n')
        : '';

    const parsed = extractJson(outputText);
    if (!parsed) return null;
    return normalizeAiJson(parsed, messageText);
};

module.exports = {
    interpretWithAI,
    isAiConfigured
};
