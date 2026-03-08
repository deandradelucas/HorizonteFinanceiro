const db = require('../../db');

const supabase = db.supabase;

const requireSupabase = () => {
    if (!supabase) {
        throw new Error('Supabase client not initialized.');
    }

    return supabase;
};

const normalizePhone = (value) => String(value || '').replace(/\D+/g, '');

const toNullableNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const toNullableDate = (value) => {
    const normalized = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

const normalizeTransactionType = (type) => {
    if (type === 'income' || type === 'receita') return 'income';
    if (type === 'expense' || type === 'despesa') return 'expense';
    if (type === 'investment' || type === 'investimento') return 'investment';
    if (type === 'query') return 'query';
    return 'unknown';
};

const normalizeTransactionRow = (row) => ({
    ...row,
    type: normalizeTransactionType(row.type),
    value: toNullableNumber(row.value) ?? 0,
    confidence: toNullableNumber(row.confidence)
});

const normalizeInterpretationRow = (row) => ({
    ...row,
    detected_type: normalizeTransactionType(row.detected_type),
    detected_amount: toNullableNumber(row.detected_amount),
    confidence: toNullableNumber(row.confidence) ?? 0,
    used_ai: Boolean(row.used_ai)
});

const findUserByPhone = async (phone) => {
    const client = requireSupabase();
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return null;

    const { data, error } = await client
        .from('users')
        .select('id, name, email, phone, role, is_active')
        .not('phone', 'is', null);

    if (error) throw error;

    return (data || []).find((user) => normalizePhone(user.phone) === normalizedPhone) || null;
};

const getIncomingMessageByProviderId = async (providerMessageId) => {
    if (!providerMessageId) return null;
    const client = requireSupabase();
    const { data, error } = await client
        .from('incoming_messages')
        .select('*')
        .eq('provider_message_id', providerMessageId)
        .maybeSingle();

    if (error) throw error;
    return data;
};

const createIncomingMessage = async (payload) => {
    const client = requireSupabase();
    const { data, error } = await client
        .from('incoming_messages')
        .insert({
            user_id: payload.user_id || null,
            phone: normalizePhone(payload.phone),
            provider_message_id: payload.provider_message_id || null,
            message_text: String(payload.message_text || '').trim(),
            raw_payload: payload.raw_payload || null,
            source: payload.source || 'whatsapp',
            processing_status: payload.processing_status || 'received'
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
};

const updateIncomingMessage = async (id, patch) => {
    const client = requireSupabase();
    const safePatch = {
        ...patch,
        phone: patch.phone ? normalizePhone(patch.phone) : undefined,
        updated_at: new Date().toISOString()
    };

    Object.keys(safePatch).forEach((key) => {
        if (safePatch[key] === undefined) delete safePatch[key];
    });

    const { data, error } = await client
        .from('incoming_messages')
        .update(safePatch)
        .eq('id', id)
        .select('*')
        .single();

    if (error) throw error;
    return data;
};

const saveInterpretation = async (incomingMessageId, interpretation) => {
    const client = requireSupabase();
    const { data, error } = await client
        .from('message_interpretations')
        .insert({
            incoming_message_id: incomingMessageId,
            detected_type: normalizeTransactionType(interpretation.type),
            detected_amount: toNullableNumber(interpretation.amount),
            detected_category: interpretation.category || null,
            detected_description: interpretation.description || null,
            detected_date: toNullableDate(interpretation.transaction_date),
            confidence: toNullableNumber(interpretation.confidence),
            used_ai: Boolean(interpretation.used_ai),
            raw_ai_output: interpretation.raw_ai_output || null,
            decision_status: interpretation.decision_status || 'pending',
            updated_at: new Date().toISOString()
        })
        .select('*')
        .single();

    if (error) throw error;
    return normalizeInterpretationRow(data);
};

const updateInterpretation = async (id, patch) => {
    const client = requireSupabase();
    const safePatch = {
        ...patch,
        detected_type: patch.detected_type ? normalizeTransactionType(patch.detected_type) : undefined,
        detected_amount: Object.prototype.hasOwnProperty.call(patch, 'detected_amount') ? toNullableNumber(patch.detected_amount) : undefined,
        detected_date: Object.prototype.hasOwnProperty.call(patch, 'detected_date') ? toNullableDate(patch.detected_date) : undefined,
        confidence: Object.prototype.hasOwnProperty.call(patch, 'confidence') ? toNullableNumber(patch.confidence) : undefined,
        used_ai: Object.prototype.hasOwnProperty.call(patch, 'used_ai') ? Boolean(patch.used_ai) : undefined,
        updated_at: new Date().toISOString()
    };

    Object.keys(safePatch).forEach((key) => {
        if (safePatch[key] === undefined) delete safePatch[key];
    });

    const { data, error } = await client
        .from('message_interpretations')
        .update(safePatch)
        .eq('id', id)
        .select('*')
        .single();

    if (error) throw error;
    return normalizeInterpretationRow(data);
};

const getLatestPendingInterpretationByUser = async (userId) => {
    const client = requireSupabase();
    const { data: messages, error: messagesError } = await client
        .from('incoming_messages')
        .select('id, user_id, message_text, phone, created_at, processing_status')
        .eq('user_id', userId)
        .in('processing_status', ['pending_confirmation', 'received'])
        .order('created_at', { ascending: false })
        .limit(10);

    if (messagesError) throw messagesError;
    if (!messages || messages.length === 0) return null;

    const incomingIds = messages.map((item) => item.id);
    const { data: interpretations, error: interpretationsError } = await client
        .from('message_interpretations')
        .select('*')
        .in('incoming_message_id', incomingIds)
        .eq('decision_status', 'pending_confirmation')
        .order('created_at', { ascending: false });

    if (interpretationsError) throw interpretationsError;

    const interpretation = (interpretations || [])[0];
    if (!interpretation) return null;

    const incoming = messages.find((item) => item.id === interpretation.incoming_message_id);
    if (!incoming) return null;

    return {
        incoming,
        interpretation: normalizeInterpretationRow(interpretation)
    };
};

const saveTransactionFromInterpretation = async ({ userId, incomingMessageId, interpretation }) => {
    const client = requireSupabase();
    const payload = {
        user_id: userId,
        type: normalizeTransactionType(interpretation.type || interpretation.detected_type),
        value: toNullableNumber(interpretation.amount ?? interpretation.detected_amount) ?? 0,
        category: String(interpretation.category || interpretation.detected_category || 'outros').trim() || 'outros',
        description: String(interpretation.description || interpretation.detected_description || '').trim() || 'Lançamento pelo WhatsApp',
        date: toNullableDate(interpretation.transaction_date || interpretation.detected_date) || new Date().toISOString().slice(0, 10),
        isrecurring: false,
        source: 'whatsapp',
        origin_message_id: incomingMessageId,
        confidence: toNullableNumber(interpretation.confidence),
        updated_at: new Date().toISOString()
    };

    const { data, error } = await client
        .from('transactions')
        .insert(payload)
        .select('*')
        .single();

    if (error) throw error;
    return normalizeTransactionRow(data);
};

const updateTransactionByMessage = async (incomingMessageId, patch) => {
    const client = requireSupabase();
    const safePatch = {
        ...patch,
        type: patch.type ? normalizeTransactionType(patch.type) : undefined,
        value: Object.prototype.hasOwnProperty.call(patch, 'value') ? toNullableNumber(patch.value) : undefined,
        date: Object.prototype.hasOwnProperty.call(patch, 'date') ? toNullableDate(patch.date) : undefined,
        updated_at: new Date().toISOString()
    };

    Object.keys(safePatch).forEach((key) => {
        if (safePatch[key] === undefined) delete safePatch[key];
    });

    const { data, error } = await client
        .from('transactions')
        .update(safePatch)
        .eq('origin_message_id', incomingMessageId)
        .select('*')
        .maybeSingle();

    if (error) throw error;
    return data ? normalizeTransactionRow(data) : null;
};

const getTransactionByMessageId = async (incomingMessageId) => {
    const client = requireSupabase();
    const { data, error } = await client
        .from('transactions')
        .select('*')
        .eq('origin_message_id', incomingMessageId)
        .maybeSingle();

    if (error) throw error;
    return data ? normalizeTransactionRow(data) : null;
};

const createOutboundMessage = async (payload) => {
    const client = requireSupabase();
    const { data, error } = await client
        .from('outbound_messages')
        .insert({
            user_id: payload.user_id || null,
            incoming_message_id: payload.incoming_message_id || null,
            phone: normalizePhone(payload.phone),
            message_text: payload.message_text,
            provider_message_id: payload.provider_message_id || null,
            delivery_status: payload.delivery_status || 'queued',
            raw_payload: payload.raw_payload || null
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
};

const logIntegrationEvent = async (payload) => {
    const client = requireSupabase();
    const { data, error } = await client
        .from('integration_logs')
        .insert({
            context: payload.context || 'whatsapp',
            level: payload.level || 'info',
            message: payload.message || '',
            payload: payload.payload || null
        })
        .select('*')
        .single();

    if (error) throw error;
    return data;
};

const listMessages = async (filters = {}) => {
    const client = requireSupabase();
    let query = client
        .from('incoming_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Math.min(parseInt(filters.limit, 10) || 100, 200));

    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.status) query = query.eq('processing_status', filters.status);
    if (filters.phone) query = query.eq('phone', normalizePhone(filters.phone));
    if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00.000Z`);
    if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59.999Z`);

    const { data: incomingMessages, error: incomingError } = await query;
    if (incomingError) throw incomingError;

    const filteredIncoming = (incomingMessages || []).filter((item) => {
        if (!filters.search) return true;
        const term = String(filters.search).trim().toLowerCase();
        return String(item.message_text || '').toLowerCase().includes(term) || String(item.phone || '').includes(term);
    });

    if (filteredIncoming.length === 0) return [];

    const incomingIds = filteredIncoming.map((item) => item.id);
    const userIds = [...new Set(filteredIncoming.map((item) => item.user_id).filter(Boolean))];

    const [interpretationsResult, transactionsResult, usersResult] = await Promise.all([
        client.from('message_interpretations').select('*').in('incoming_message_id', incomingIds).order('created_at', { ascending: false }),
        client.from('transactions').select('*').in('origin_message_id', incomingIds).order('created_at', { ascending: false }),
        userIds.length
            ? client.from('users').select('id, name, email, phone').in('id', userIds)
            : Promise.resolve({ data: [], error: null })
    ]);

    if (interpretationsResult.error) throw interpretationsResult.error;
    if (transactionsResult.error) throw transactionsResult.error;
    if (usersResult.error) throw usersResult.error;

    const userMap = new Map((usersResult.data || []).map((item) => [item.id, item]));
    const interpretationMap = new Map();
    const transactionMap = new Map();

    (interpretationsResult.data || []).forEach((row) => {
        if (!interpretationMap.has(row.incoming_message_id)) {
            interpretationMap.set(row.incoming_message_id, normalizeInterpretationRow(row));
        }
    });

    (transactionsResult.data || []).forEach((row) => {
        if (!transactionMap.has(row.origin_message_id)) {
            transactionMap.set(row.origin_message_id, normalizeTransactionRow(row));
        }
    });

    return filteredIncoming.map((message) => ({
        ...message,
        user: message.user_id ? userMap.get(message.user_id) || null : null,
        interpretation: interpretationMap.get(message.id) || null,
        transaction: transactionMap.get(message.id) || null
    }));
};

const getMessageDetails = async (messageId) => {
    const rows = await listMessages({ limit: 200 });
    return rows.find((row) => String(row.id) === String(messageId)) || null;
};

const listUserTransactions = async (userId) => {
    const client = requireSupabase();
    const { data, error } = await client
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('id', { ascending: false });

    if (error) throw error;
    return (data || []).map(normalizeTransactionRow);
};

module.exports = {
    normalizePhone,
    normalizeTransactionType,
    findUserByPhone,
    getIncomingMessageByProviderId,
    createIncomingMessage,
    updateIncomingMessage,
    saveInterpretation,
    updateInterpretation,
    getLatestPendingInterpretationByUser,
    saveTransactionFromInterpretation,
    updateTransactionByMessage,
    getTransactionByMessageId,
    createOutboundMessage,
    logIntegrationEvent,
    listMessages,
    getMessageDetails,
    listUserTransactions
};
